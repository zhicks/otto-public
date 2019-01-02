declare const $;
declare const JsDiff;

import { Component, OnInit } from '@angular/core';
import {ApiService} from "../api/api.service";
import {ActivatedRoute, Router} from "@angular/router";
import {OttoGroup, OttoLight} from "../../../../otto-shared/otto-interfaces";
import {Subscription} from "rxjs/Subscription";
import {OttoItemType} from "../../../../otto-shared/constants";

const LOCAL_STORAGE_KEY = 'SAVED_BOARD_MSG';

interface SavedData {
  date: number,
  data: TextAreaWithData[]
}

interface TextAreaWithData {
  character: string,
  color: number[]
}

@Component({
  selector: 'app-led-matrix-board',
  templateUrl: './led-matrix-board.component.html',
  styleUrls: ['./led-matrix-board.component.scss']
})
export class LEDMatrixBoardComponent {

  activeTab = 'write';
  currentColor = [255, 255, 255];
  textAreaContent = '';
  textAreaWithData: TextAreaWithData[] = [];
  friendlyTextAreaWithData: TextAreaWithData[][] = [];
  previousTextAreaContent = '';
  saved: SavedData[] = [];

  ngOnInit() {
    let saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      this.saved = JSON.parse(saved) || [];
      console.log(this.saved);
      this.sortSaved();
    }
  }

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

    const previousTextAreaContent = this.previousTextAreaContent;

    // say it's stuff and now stuffy
    // say it's stuffy and now stuff
    // say it's stffy and now stuffy
    // say it's stuffy and now stffy
    // say it's stuffy and now stand
    // say it's stuffy and now bork
    let changeContents = JsDiff.diffChars(previousTextAreaContent, this.textAreaContent);
    let runningIndex = 0;
    let changeContentsWithIndexes = [];
    for (let c of changeContents) {
      if (c.removed ) {
        // console.log('removed ', c.count, ' at index', runningIndex);
        changeContentsWithIndexes.push({
          count: c.count,
          index: runningIndex,
          isRemoval: true
        });
      }
      if (c.added) {
        // console.log('added ', c.count, ' at index', runningIndex);
        changeContentsWithIndexes.push({
          count: c.count,
          index: runningIndex,
          isRemoval: false,
          value: c.value
        });
      }
      // console.log(c);
      runningIndex += c.count;
    }

    // console.warn('note that if you remove multiples at a time, the indexes match the PREVIOUS thing, not the current thing - which should be beneficial');

    this.previousTextAreaContent = this.textAreaContent;

    // here - build out the array, char and color. for each one removed or added. iterate backwards.
    for (let i = changeContentsWithIndexes.length - 1; i >= 0; i--) {
      let c = changeContentsWithIndexes[i];
      // here we know to either add or remove at that index
      if (c.isRemoval) {
        this.textAreaWithData.splice(c.index, c.count);
      } else {
        for (let val of c.value) {
          // if (val === '\n') {
          //   console.log('its enter');
          // }
          this.textAreaWithData.splice(c.index, 0, {
            character: val,
            color: this.currentColor
          });
        }
      }
    }

    // console.log(this.textAreaWithData);
    this.updatePreview();
  }

  sendClicked() {
    console.log(this.friendlyTextAreaWithData);
    let stringToSend = '';
    for (let i = 0; i < this.friendlyTextAreaWithData.length; i++) {
      let row = this.friendlyTextAreaWithData[i];
      for (let charInfo of row) {
        stringToSend += charInfo.character;
        stringToSend += `${charInfo.color[0]},${charInfo.color[1]},${charInfo.color[2]}`;
      }
      if (i + 1 !== this.friendlyTextAreaWithData.length) {
        stringToSend += '[';
      }
    }
    console.log(stringToSend);
    this.saveMsg();
  }

  applySave(data: SavedData) {
    this.textAreaWithData = data.data;
    this.updatePreview();
    this.activeTab = 'write';
  }

  saveClicked() {
    this.saveMsg();
  }

  private saveMsg() {
    let savedStr = localStorage.getItem(LOCAL_STORAGE_KEY);
    let saved: SavedData[] = [];
    if (savedStr) {
      saved = JSON.parse(savedStr);
    }
    saved.push({
      date: new Date().getTime(),
      data: this.textAreaWithData
    });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saved));
    this.saved = saved;
    this.sortSaved();
  }

  sortSaved() {
    this.saved.sort((a, b) => {
      if (a.date < b.date) {
        return 1;
      }
      return -1;
    })
  }

  updatePreview() {
    this.friendlyTextAreaWithData = [ [] ];
    let index = 0;
    for (let charInfo of this.textAreaWithData) {
      if (charInfo.character === '\n') {
        index++;
        this.friendlyTextAreaWithData.push([]);
      } else {
        this.friendlyTextAreaWithData[index].push(charInfo);
      }
    }
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
