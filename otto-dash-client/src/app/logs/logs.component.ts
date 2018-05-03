import { Component, OnInit } from '@angular/core';
import {ApiService} from "../api/api.service";
import {ActivatedRoute, Router} from "@angular/router";
import {Subscription} from "rxjs/Subscription";
import {OttoGroup, OttoLight, OttoLoggerMessage, OttoSatellite} from "../../../../otto-shared/otto-interfaces";
import {OttoItemType} from "../../../../otto-shared/constants";

@Component({
  selector: 'app-logs',
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.scss']
})
export class LogsComponent implements OnInit {

  sub: Subscription;
  logs: OttoLoggerMessage[] = [];
  OttoItemType = OttoItemType;

  constructor(
    public router: Router,
    public activatedRoute: ActivatedRoute,
    private apiService: ApiService
  ) { }

  async ngOnInit() {
    this.sub = this.activatedRoute.params.subscribe(async (params) => {
      let id = params && params['id'];
      let socket = this.apiService.socket;
      socket.on('log_dump', this.onLogDump.bind(this));
      socket.on('new_log', this.onNewLog.bind(this));
      socket.emit('app_log_dump', id ? { id: id } : null);
    });
  }

  ngOnDestroy() {
    this.sub && this.sub.unsubscribe();
  }

  private onLogDump(messages: OttoLoggerMessage[]) {
    console.log(messages);
    messages.reverse();
    this.logs.push.apply(this.logs, messages);
  }

  private onNewLog(messages: OttoLoggerMessage[]) {
    console.log('on new log');
    console.log(messages);
    this.logs.push.apply(this.logs, messages);
  }

  backClicked() {
    this.router.navigate(['../']);
  }

}
