import { Injectable } from '@angular/core';
import {Http} from "@angular/http";
import {OttoBaseItem, OttoDb, OttoItem} from "../../../../otto-shared/otto-interfaces";
import {OttoItemType} from "../../../../otto-shared/constants";

declare const io;

@Injectable()
export class ApiService {

  private baseUrl = '/api';
  socket: any;
  model: OttoDb;

  constructor(
    private http: Http
  ) {
    this.socket = io();
  }

  async getStuff(): Promise<OttoDb> {
    let resource = `${this.baseUrl}/stuff`;
    let response = await this.http.get(resource).toPromise();
    this.model = response.json();
    return this.model;
  }

  async getItemById(type: OttoItemType, id: string): Promise<OttoBaseItem> {
    let resource = `${this.baseUrl}/stuff/${type}/${id}`;
    let response = await this.http.get(resource).toPromise();
    return response.json();
  }

  async saveGroup(id: string, newName: string) {
    let resource = `${this.baseUrl}/group`;
    if (id) {
      resource += `/${id}`;
    }
    let response = await this.http.post(resource, {
      name: newName
    }).toPromise();
    return response.json();
  }

  async saveNameForItem(type: OttoItemType, id: string, newName: string) {
    let resource = `${this.baseUrl}/${type}/${id}/name`;
    let response = await this.http.post(resource, {
      name: newName
    }).toPromise();
    return response.json();
  }

  async saveGroupForItem(type: OttoItemType, id: string, groupId: string) {
    let resource = `${this.baseUrl}/${type}/${id}/group`;
    let response = await this.http.post(resource, {
      groupId: groupId
    }).toPromise();
    return response.json();
  }

}
