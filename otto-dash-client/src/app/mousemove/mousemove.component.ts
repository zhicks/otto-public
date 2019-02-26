import { Component, OnInit } from '@angular/core';
import {ApiService} from "../api/api.service";
import {Router} from "@angular/router";
import {OttoObjectStatus} from "../../../../otto-shared/constants";
import {OttoStatusData} from "../../../../otto-shared/otto-interfaces";

@Component({
  selector: 'app-mousemove',
  templateUrl: './mousemove.component.html',
  styleUrls: ['./mousemove.component.scss']
})
export class MouseMoveComponent implements OnInit {

  status = 'Waiting...';

  constructor(
    private apiService: ApiService,
    private router: Router
  ) { }

  async ngOnInit() {
    let socket = this.apiService.socket;
    socket.on('app_receive_mousemove_status', (isOn: boolean) => {
      console.log('got mouse move status');
      this.status = isOn ? 'On' : 'Off';
    });
    socket.emit('app_mousemove_status');
    setInterval(() => {
      console.log('asking for mousemove status');
      socket.emit('app_mousemove_status');
    }, 1000);
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
