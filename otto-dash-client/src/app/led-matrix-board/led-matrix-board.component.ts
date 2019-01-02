declare const $;
declare const JsDiff;

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

  activeTab = 'write';
  currentColor = [0, 0, 0];
  textAreaContent = '';
  textAreaWithData: { character: string, color: number[] }[] = [];

  tempPreviousTextAreaContent = '';

  ngAfterViewInit() {
    var box = $('#box')[0];

    $("#slider-horiz").slider({
      orientation: "vertical",
      min: 0,
      max: 360,
      value: 0,
      slide: (event, ui) => {
        const color = this.hslToRgb(ui.value/360, 1, .5);
        this.currentColor = color;
        console.log(color);
        box.style.background = 'hsl(' + ui.value + ', 100%, 50%)';
      }
    });
  }

  changeActiveTab(tab: string) {
    this.activeTab = tab;
  }

  textAreaChanged(event) {
    // need to determine what's new - everything that is new gets that color
    // and need to determine what's missing
    // const previousTextAreaContent = this.textAreaWithData.map(t => t.character).join('');

    const previousTextAreaContent = this.tempPreviousTextAreaContent;

    // say it's stuff and now stuffy
    // say it's stuffy and now stuff
    // say it's stffy and now stuffy
    // say it's stuffy and now stffy
    // say it's stuffy and now stand
    // say it's stuffy and now bork
    let changeContents = JsDiff.diffChars(previousTextAreaContent, this.textAreaContent);
    let runningIndex = 0;
    for (let c of changeContents) {
      if (c.removed ) {
        console.log('removed ', c.count, ' at index', runningIndex);
      }
      if (c.added) {
        console.log('added ', c.count, ' at index', runningIndex);
      }
      // console.log(c);
      runningIndex += c.count;
    }

    console.warn('note that if you remove multiples at a time, the indexes match the PREVIOUS thing, not the current thing - which should be beneficial');

    this.tempPreviousTextAreaContent = this.textAreaContent;

  }

  hslToRgb(h, s, l){
    var r, g, b;

    if(s == 0){
      r = g = b = l; // achromatic
    }else{
      var hue2rgb = function hue2rgb(p, q, t){
        if(t < 0) t += 1;
        if(t > 1) t -= 1;
        if(t < 1/6) return p + (q - p) * 6 * t;
        if(t < 1/2) return q;
        if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      }

      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

}
