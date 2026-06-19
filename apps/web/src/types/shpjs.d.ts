declare module 'shpjs' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function shp(data: string | ArrayBuffer): Promise<any>
  export default shp
}
