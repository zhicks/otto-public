import { Component, OnInit } from '@angular/core';
import {ApiService} from "../api/api.service";
import {Router} from "@angular/router";

interface HierarchicalData {
  id: string,
  name: string,
  lights: {
    id: string,
    name: string,
    type: string,
    group: HierarchicalData
  }[],
  satellites: {
    id: string,
    name: string,
    group: HierarchicalData
  }[]
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  model: {
    groups: HierarchicalData[]
  }

  constructor(
    private apiService: ApiService,
    private router: Router
  ) { }

  async ngOnInit() {
    let unassignedGroup: HierarchicalData = {
      id: '',
      name: 'Unassigned',
      lights: [],
      satellites: []
    }
    let stuff = await this.apiService.getStuff();
    console.log(stuff);
    this.model = { groups: [] };
    for (let group of stuff.groups) {
      let newGroup: HierarchicalData = {...group, lights: [], satellites: []};
      this.model.groups.push(newGroup);
    }
    for (let light of stuff.lights) {
      let groupObj = this.model.groups.find(group => group.id === light.group);
      if (!groupObj) {
        unassignedGroup.lights.push({...light, group: groupObj});
      } else {
        groupObj.lights.push({...light, group: groupObj});
      }
    }
    for (let satellite of stuff.satellites) {
      let groupObj = this.model.groups.find(group => group.id === satellite.group);
      if (!groupObj) {
        unassignedGroup.satellites.push({...satellite, group: groupObj});
      } else {
        groupObj.satellites.push({...satellite, group: groupObj});
      }
    }
    this.model.groups.push(unassignedGroup);
  }

  addGroupClicked() {
    console.log('add group');
    this.router.navigate(['group']);
  }

  satelliteClicked(satellite: any) {
    console.log('sat clicked', satellite);
    this.router.navigate(['satellite', satellite.id]);
  }

  lightClicked(light: any) {
    console.log('light clicked', light);
    this.router.navigate(['light', light.id]);
  }
}
