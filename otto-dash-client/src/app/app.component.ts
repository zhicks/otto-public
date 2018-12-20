import { Component } from '@angular/core';
import {ApiService} from './api/api.service';
import {Router, ActivatedRoute} from '@angular/router';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  hideHeader = false;

  constructor(
    private route: ActivatedRoute
  ) {
    if (window.location.pathname.indexOf('board') > -1) {
      this.hideHeader = true;
    }
  }


}
