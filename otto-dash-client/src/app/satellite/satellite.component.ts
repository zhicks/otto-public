import { Component, OnInit } from '@angular/core';
import {ApiService} from "../api/api.service";
import {ActivatedRoute, Router} from "@angular/router";
import {Subscription} from "rxjs/Subscription";
import {OttoGroup, OttoLight, OttoSatellite} from "../../../../otto-shared/otto-interfaces";
import {OttoItemType} from "../../../../otto-shared/constants";

@Component({
  selector: 'app-satellite',
  templateUrl: './satellite.component.html',
  styleUrls: ['./satellite.component.scss']
})
export class SatelliteComponent implements OnInit {

  sub: Subscription;
  editingSat: OttoSatellite;
  groups: OttoGroup[] = [];
  selectedGroup: OttoGroup;

  constructor(
    public router: Router,
    public activatedRoute: ActivatedRoute,
    private apiService: ApiService
  ) { }

  async ngOnInit() {
    this.sub = this.activatedRoute.params.subscribe(async (params) => {
      let stuff = await this.apiService.getStuff();
      this.groups = stuff.groups;
      let id = params && params['id'];
      if (!id) {
        this.editingSat = {
          id: '',
          name: '',
          group: ''
        }
      } else {
        console.log(id);
        let sat: OttoSatellite = <OttoSatellite> await this.apiService.getItemById(OttoItemType.Satellite, id);
        this.editingSat = {...sat};
        this.selectedGroup = this.groups.find(group => group.id === this.editingSat.group);
      }
    });
  }

  ngOnDestroy() {
    this.sub && this.sub.unsubscribe();
  }

  async saveClicked() {
    if (this.selectedGroup) {
      this.editingSat.group = this.selectedGroup.id;
    }
    let result = await this.apiService.saveNameForItem(OttoItemType.Satellite, this.editingSat.id, this.editingSat.name);
    console.log(result);
    result = await this.apiService.saveGroupForItem(OttoItemType.Satellite, this.editingSat.id, this.editingSat.group);
    console.log(result);
    this.router.navigate(['../']);
  }

  cancelClicked() {
    this.router.navigate(['../']);
  }

  logsClicked() {
    this.router.navigate(['logs'], { relativeTo: this.activatedRoute });
  }

}
