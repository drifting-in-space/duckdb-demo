type BaseResponse = { queryTime: number }

export type TotalTripsResponse = { totalTrips: number } & BaseResponse
export type TripsTimerangeResponse = { tripsTimerange: [string, string] } & BaseResponse
export type MaxHourlyTripsResponse = { maxHourlyTrips: number } & BaseResponse

export type StationId = number;
export type StationMetadata = { id: StationId; latitude: number; longitude: number; name: string }
export type StationsMetadataResponse = { stations: StationMetadata[] } & BaseResponse

export type EndStationsByStartStationResponse = {
  stationId: StationId;
  tripCountByEndStation: Record<StationId, number>
} & BaseResponse

export type UserType = 'Subscriber' | 'Customer'
export type UserTypesByStartStationResponse = {
  stationId: StationId;
  tripCountByUserType: Record<UserType, number>
} & BaseResponse

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type HourlyCountsPerDay = number[]
export type TripCountByDay = Record<DayOfWeek, HourlyCountsPerDay>
export type HourlyTripCountByStartStationResponse = {
  stationId: StationId;
  tripCountByDay: TripCountByDay;
} & BaseResponse

export type UserBirthYear = number;
export type UserBirthYearByStartStationResponse = {
  stationId: StationId;
  tripCountByUserBirthYear: Record<UserBirthYear, number>;
} & BaseResponse

// types for what we expect to be returned from DuckDB

export type TotalTripsDB = { 'count_star()': number }[]
export type TripsTimerangeDB = { 'min(start_time)': Date; 'max(start_time)': Date }[]
export type MaxHourlyTripsDB = { 'count_star()': number }[]
export type StationMetadataDB = {
  start_station_id: StationId;
  start_station_latitude: number;
  start_station_longitude: number;
  start_station_name: string;
}
export type StationsMetadataDB = StationMetadataDB[]
export type EndStationsByStartStationDB = { end_station_id: number; 'count_star()': number }[]
export type UserTypesByStartStationDB = { user_type: UserType; 'count_star()': number }[]
export type HourlyTripCountByStartStationDB = { 'dayofweek(start_time)': DayOfWeek; 'hour(start_time)': number; 'count_star()': number }[]
export type UserBirthYearByStartStationDB = { birth_year: number; 'count_star()': number }[]
