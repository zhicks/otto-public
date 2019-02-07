import { Component, OnInit } from '@angular/core';
import {ApiService} from "../api/api.service";
import {Router} from "@angular/router";
import {OttoObjectStatus} from "../../../../otto-shared/constants";
import {OttoStatusData} from "../../../../otto-shared/otto-interfaces";

enum OffOnStatus {
  Off,
  On,
  Loading
}

@Component({
  selector: 'app-mousemove',
  templateUrl: './mousemove.component.html',
  styleUrls: ['./mousemove.component.scss']
})
export class MouseMoveComponent implements OnInit {

  mousemoveIsOn = OffOnStatus.Loading;
  OffOnStatus = OffOnStatus;

  constructor(
    private apiService: ApiService,
    private router: Router
  ) { }

  async ngOnInit() {
    let socket = this.apiService.socket;
    socket.on('mousemove_status', (offOrOn: boolean) => {
      console.log('got mouse move status');
      this.mousemoveIsOn = offOrOn ? OffOnStatus.On : OffOnStatus.Off;
    });
    socket.emit('app_get_mousemove_status');
  }

  turnOnClicked() {
    this.apiService.socket.emit('app_mousemove_turn_on');
  }

  turnOffClicked() {
    this.apiService.socket.emit('app_mousemove_turn_off');
  }

  ngOnDestroy() {
    let socket = this.apiService.socket;
    socket.off('mousemove_status');
  }
}
