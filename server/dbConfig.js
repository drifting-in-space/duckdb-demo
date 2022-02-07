module.exports = {
  // `tableName` is the name to give to the db table that the data is loaded into
  tableName: 'citibike_trips',
  // `schema` is an ordered list of columns and their datatypes for the CSV
  // that's inserted into the table
  schema: [
    ['duration', 'INT'],
    ['start_time', 'TIMESTAMP'],
    ['stop_time', 'TIMESTAMP'],
    ['start_station_id', 'INT'],
    ['start_station_name', 'VARCHAR'],
    ['start_station_latitude', 'FLOAT4'],
    ['start_station_longitude', 'FLOAT4'],
    ['end_station_id', 'INT'],
    ['end_station_name', 'VARCHAR'],
    ['end_station_latitude', 'FLOAT4'],
    ['end_station_longitude', 'FLOAT4'],
    ['bike_id', 'INT'],
    ['user_type', 'VARCHAR'],
    ['birth_year', 'INT'],
    ['gender', 'INT']
  ]
}
