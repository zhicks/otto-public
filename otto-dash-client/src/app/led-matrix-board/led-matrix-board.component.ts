import { Component, OnInit } from '@angular/core';
import {ApiService} from "../api/api.service";
import {ActivatedRoute, Router} from "@angular/router";
import {OttoGroup, OttoLight} from "../../../../otto-shared/otto-interfaces";
import {Subscription} from "rxjs/Subscription";
import {OttoItemType} from "../../../../otto-shared/constants";

@Component({
  selector: 'app-led-matrix-board',
  templateUrl: './led-matrix-board.component.html',
  styleUrls: ['./led-matrix-board.component.scss']
})
export class LEDMatrixBoardComponent {

}
