const path = require('path')
const { mkdirSync, existsSync } = require('fs')
const { exec } = require('child_process')
const { Server } = require('socket.io')
const express = require('express')
const duckdb = require('duckdb')
require('dotenv').config({
  path: path.resolve(process.cwd(), '.env.default'),
  override: false
})

// TODO: share tableName and QueryResponse type with FE
const tableName = 'citibike_trips'
type QueryResponse<ResultT> = {
  queryStr: string;
  queryTime: number;
  result: ResultT;
  cacheHit: boolean;
  prefetch: boolean;
}

const DB_DIR = 'db'
const DEMO_DATA_SOURCE = process.env.DEMO_DATA_SOURCE

const dataFilename = path.basename(DEMO_DATA_SOURCE)
const dataPath = isUri(DEMO_DATA_SOURCE) ? path.join(__dirname, '..', DB_DIR, dataFilename) : DEMO_DATA_SOURCE
const dataDir = path.dirname(dataPath)

mkdirSync(dataDir, { recursive: true })

fetchData(DEMO_DATA_SOURCE, dataPath)
  .then(createDatabase)
  .then(startServer)
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

function startServer(db: typeof duckdb.Database) {
  const port = process.env.SERVER_PORT
  const app = express()

  app.use(express.json())
  app.use(express.static(path.join(__dirname, '../../client/build')))

  const server = app.listen(port, () => {
    console.log(`server started at http://0.0.0.0:${port}`)
  });

  const io = new Server(server)

  // -----------------------------------------------------
  // TO TRY:
  // 1. cache all the queries in process memory here and send them down in the background
  // to all newly connected dashboards
  // 2. when a query is cancelled, simply deprioritize it, but still do the query and send
  // the results down in the background
  // -----------------------------------------------------

  const cache = new Map<string, any>()
  const allFetchedQueries: string[] = []

  let connectionsCount = 0
  io.on('connection', (socket: any) => {
    const startTime = performance.now()
    const idx = connectionsCount++
    console.log((performance.now() - startTime) | 0, 'CONNECTED TO CLIENT', idx)

    const prefetchedQueriesCount = allFetchedQueries.length
    let curPrefetchQuery = 0

    setTimeout(function sendPrefetch() {
      const qStr = allFetchedQueries[curPrefetchQuery]
      curPrefetchQuery += 1
      if (cache.has(qStr)) {
        const queryTime = 0
        const cacheHit = true
        const prefetch = true
        const result = cache.get(qStr)
        sendResponse(qStr, queryTime, cacheHit, prefetch, result)
      } else {
        console.warn('queryString seen but result not cached')
      }
      if (curPrefetchQuery < prefetchedQueriesCount) setTimeout(sendPrefetch, 5)
    }, 5)

    const queryQueue: string[] = []
    const queryIsCancelled = new Map<string, boolean>()
    let isQuerying = false

    socket.on('query', (queryStr: string) => {
      // console.log((performance.now() - startTime) | 0, 'request for:', queryStr)
      if (cache.has(queryStr)) {
        const queryTime = 0
        const cacheHit = true
        const prefetch = false
        const result = cache.get(queryStr)
        sendResponse(queryStr, queryTime, cacheHit, prefetch, result)
        return
      }
      queryQueue.push(queryStr)
      queryIsCancelled.set(queryStr, false)
      makeQuery()
    });

    socket.on('cancel', (queryStr: string) => {
      // console.log((performance.now() - startTime) | 0, 'request for:', queryStr)
      queryIsCancelled.set(queryStr, true)
    })

    function makeQuery(): void {
      if (isQuerying || queryQueue.length === 0) return
      const queryStr = queryQueue.shift()
      if (queryIsCancelled.get(queryStr)) {
        return makeQuery()
      }
      const dbCallPlaced = performance.now()
      isQuerying = true
      db.all(queryStr, (err: any, result: any) => {
        console.log((performance.now() - startTime) | 0, (performance.now() - dbCallPlaced) | 0, 'db response for:', queryStr)
        isQuerying = false
        if (!cache.has(queryStr)) allFetchedQueries.push(queryStr)
        cache.set(queryStr, result)
        makeQuery()
        if (err) {
          // TODO: send error to client?
          console.warn(`duckdb: error from ${queryStr}`, err)
        }

        const queryTime = performance.now() - dbCallPlaced
        const cacheHit = false
        const prefetch = false
        sendResponse(queryStr, queryTime, cacheHit, prefetch, result)
      })
    }

    function sendResponse(queryStr: string, queryTime: number, cacheHit: boolean, prefetch: boolean, result: any) {
      const response: QueryResponse<any> = { queryStr, queryTime, result, prefetch, cacheHit }
      socket.emit('query-response', response)
    }
  });

  app.get('/', (req: any, res: any) => {
    res.sendFile(path.join(__dirname, '../../client/build/index.html'))
  })
}

function fetchData(dataUri: string, dataPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (existsSync(dataPath)) {
      console.log(`data found at path: ${dataPath}`)
      resolve()
    } else {
      console.log(`data not found at path: ${dataPath}`)
      if (!isUri(dataUri)) {
        console.warn(`unable to cURL DEMO_DATA_SOURCE: ${DEMO_DATA_SOURCE}`)
        reject()
        return
      }
      console.log(`downloading data from ${dataUri}`)
      const child = exec(`curl ${dataUri} > ${dataPath}`, (err: Error) => {
        if (err) {
          console.warn('curl error fetching data:', err)
          reject(err)
          return
        }
        resolve()
      })
      child.stderr.on('data', (chunk: string) => process.stderr.write(chunk))
    }
  })
}

function createDatabase() {
  return new Promise((resolve, reject) => {
    console.log('loading database')
    const dbLoadStart = Date.now()
    const db = new duckdb.Database(':memory:')
    db.all(`CREATE TABLE ${tableName} AS SELECT * FROM parquet_scan('${dataPath}')`, (err: Error) => {
      if (err) {
        console.error('duckdb error creating table:', err)
        reject(err)
      }
      console.log(`duckdb database created in ${Date.now() - dbLoadStart} ms`)
      db.all('SET access_mode=READ_ONLY', (err: Error) => {
        if (err) {
          console.error('duckdb error setting to read only:', err)
          reject(err)
        }
        console.log('duckdb database set to read only')
        // db.run('PRAGMA enable_profiling')
        db.all('SELECT * FROM duckdb_settings()', (err: Error, response: any) => {
          if (err) {
            console.error('duckdb error reading settings:', err)
            reject(err)
          }
          const settings = Object.fromEntries(response.map((setting: any) => [setting.name, setting.value]))
          console.log('duckdb database running with settings:', settings)
          resolve(db)
        })
      })
    })
  })
}
function isUri(uri: string) {
  return uri.search(/https?:\/\//) === 0
}
