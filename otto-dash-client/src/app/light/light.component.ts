import { Component, OnInit } from '@angular/core';
import {ApiService} from "../api/api.service";
import {ActivatedRoute, Router} from "@angular/router";
import {OttoGroup, OttoLight} from "../../../../otto-shared/otto-interfaces";
import {Subscription} from "rxjs/Subscription";
import {OttoItemType} from "../../../../otto-shared/constants";

@Component({
  selector: 'app-light',
  templateUrl: './light.component.html',
  styleUrls: ['./light.component.scss']
})
export class LightComponent implements OnInit {

  sub: Subscription;
  editingLight: OttoLight;
  groups: OttoGroup[] = [];
  selectedGroup: OttoGroup;

  constructor(
    public router: Router,
    public activatedRoute: ActivatedRoute,
    private apiService: ApiService
  ) { }

  async ngOnInit() {
    this.sub = this.activatedRoute.params.subscribe(async (params) => {
      // Removed for public purposes
    });
  }

  ngOnDestroy() {
    this.sub && this.sub.unsubscribe();
  }

  async saveClicked() {
    if (this.selectedGroup) {
      this.editingLight.group = this.selectedGroup.id;
    }
    let result = await this.apiService.saveNameForItem(OttoItemType.Light, this.editingLight.id, this.editingLight.name);
    console.log(result);
    result = await this.apiService.saveGroupForItem(OttoItemType.Light, this.editingLight.id, this.editingLight.group);
    console.log(result);
    this.router.navigate(['../']);
  }

  cancelClicked() {
    this.router.navigate(['../']);
  }

}
