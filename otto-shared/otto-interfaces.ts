export interface OttoDb {
    groups: OttoGroup[],
    lights: OttoLight[],
    satellites: OttoSatellite[]
}

export interface OttoGroup {
    id: string,
    name: string
}

export interface OttoBaseItem {
    id: string,
    name: string,
}

export interface OttoItem extends OttoBaseItem {
    group: string
}

export interface OttoLight extends OttoItem {
    type: string
}

export interface OttoSatellite extends OttoItem {

}