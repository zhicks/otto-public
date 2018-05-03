import {OttoItemType, OttoObjectStatus} from "./constants";

export interface OttoDb {
    groups: OttoGroup[],
    lights: OttoLight[],
    satellites: OttoSatellite[]
}

export interface OttoGroup {
    id: string,
    name: string,
    lightTimeout: number
}

export interface OttoLoggerMessage {
    ts: Date,
    ms: any,
    id: string,
    type: OttoItemType
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

export interface OttoStatusData {
    groups: {
        id: string,
        lights?: {
            id: string,
            status: OttoObjectStatus
        }[],
        motion?: {
            status: OttoObjectStatus
        }
    }[]
}
