declare const $;
declare const JsDiff;

import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import {ApiService} from "../api/api.service";
import {ActivatedRoute, Router} from "@angular/router";
import {OttoGroup, OttoLight} from "../../../../otto-shared/otto-interfaces";
import {Subscription} from "rxjs/Subscription";
import {OttoItemType} from "../../../../otto-shared/constants";

const LOCAL_STORAGE_KEY = 'SAVED_BOARD_MSG';

interface SavedData {
  date: number,
  fontSize: number,
  data: CharWithData[]
}

interface CharWithData {
  character: string,
  color: number[] | string[]
}

interface FriendlySavedData {
  f: CharWithData[][], // friendly
  d: number, // date
  s: CharWithData[] // textarea
}

(<any>Number.prototype).pad = function(size) {
  var s = String(this);
  while (s.length < (size || 2)) {s = "0" + s;}
  return s;
}

@Component({
  selector: 'app-led-matrix-board',
  templateUrl: './led-matrix-board.component.html',
  styleUrls: ['./led-matrix-board.component.scss']
})
export class LEDMatrixBoardComponent {

  @ViewChild('textarea') textarea: ElementRef;

  activeTab = 'write';
  currentColor = ['255', '255', '255'];
  textAreaContent = '';
  charsWithData: CharWithData[] = [];
  // vv Just used for preview
  friendlyTextAreaWithData: CharWithData[][] = [];
  // vv Just used to display on saved screen
  friendlySavedDatas: FriendlySavedData[] = [];
  previousTextAreaContent = '';
  saved: SavedData[] = [];
  socket: any;
  boardIp = 'refresh for ip';
  touchingSlider = false;
  showColor = false;
  selectedFontSize: { s, chars };
  fontSizes = [
    { s: 1, chars: 8 },
    { s: 2, chars: 6 },
    { s: 3, chars: 4 },
    { s: 4, chars: 4 },
    { s: 5, chars: 3 }
  ];
  leftOnLine = 8;
  fadeCharsLeft = null;

  constructor(
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.selectedFontSize = this.fontSizes[0];
    this.socket = this.apiService.socket;
    this.socket.on('kathleen_board_ip', (ip: string) => {
      console.log('ip is', ip);
      this.boardIp = ip;
    });
    this.socket.emit('kathleen_board_app');
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
        let value = ui.value;
        if (value < 3) {
          // We'll just change this to white
          const color = ['255', '255', '255'];
          this.currentColor = color;
          box.style.background = 'white';
        } else {
          const color = <any>this.hslToRgb(value/360, 1, .5);
          for (let i = 0; i < color.length; i++) {
            color[i] = (<any>color[i]).pad(3);
          }
          this.currentColor = color;
          box.style.background = 'hsl(' + value + ', 100%, 50%)';
        }
      },
      start: () => {
        this.touchingSlider = true;
      },
      stop: () => {
        this.touchingSlider = false;
        $('textarea').focus();
      }
    });
  }

  changeActiveTab(tab: string) {
    if (tab === 'saved') {
      this.friendlySavedDatas = [];
      for (let saved of this.saved) {
        let charDataArray = saved.data;
        let friendly = this.updatePreview(charDataArray);
        this.friendlySavedDatas.push({
          f: friendly,
          d: saved.date,
          s: charDataArray
        });
      }
    }
    this.activeTab = tab;
  }

  displayClockPressed() {
    this.socket.emit('kathleen_board_app_displayClock');
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
        this.charsWithData.splice(c.index, c.count);
      } else {
        for (let val of c.value) {
          // if (val === '\n') {
          //   console.log('its enter');
          // }
          this.charsWithData.splice(c.index, 0, {
            character: val,
            color: this.currentColor
          });
        }
      }
    }

    // console.log(this.textAreaWithData);
    this.friendlyTextAreaWithData = this.updatePreview(this.charsWithData);

    this.calculateCharsLeft();
  }

  calculateCharsLeft() {
    let textArea = this.textarea.nativeElement;
    let lineNum = textArea.value.substr(0, textArea.selectionStart).split("\n").length - 1;
    let lines = this.textAreaContent.split('\n');
    let line = lines[lineNum];
    let left = this.selectedFontSize.chars - line.length;
    this.leftOnLine = left;
    clearTimeout(this.fadeCharsLeft);
    $('#charsleft').css('opacity', 1);
    this.fadeCharsLeft = setTimeout(() => {
      $('#charsleft').css('opacity', 0);
    }, 1000);
  }

  sendClicked() {
    this.showColor = false;
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

    this.socket.emit('app_sendBoardMessage', {
      message: stringToSend,
      fontSize: this.selectedFontSize.s
    });

  }

  applySave(data: FriendlySavedData) {
    // let c: CharWithData[] = [];
    // let i = 0;
    // for (let x of data) {
    //   if (i !== 0) {
    //     c.push({
    //       character: '\n',
    //       color: ['255', '255', '255']
    //     });
    //   }
    //   c.push(...x);
    //   i++;
    // }
    this.charsWithData = data.s;
    this.textAreaContent = this.previousTextAreaContent = data.s.map(q => q.character).join('');
    this.friendlyTextAreaWithData = data.f;
    this.activeTab = 'write';
  }

  saveClicked() {
    this.showColor = false;
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
      data: this.charsWithData,
      fontSize: this.selectedFontSize.s
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

  updatePreview(charsWithData: CharWithData[]) {
    let friendly: CharWithData[][] = [ [] ];
    let index = 0;
    for (let charInfo of charsWithData) {
      if (charInfo.character === '\n') {
        index++;
        friendly.push([]);
      } else {
        friendly[index].push(charInfo);
      }
    }
    return friendly;
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
