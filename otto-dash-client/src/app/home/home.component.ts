import { Component, OnInit } from '@angular/core';
import {ApiService} from "../api/api.service";
import {Router} from "@angular/router";
import {OttoObjectStatus} from "../../../../otto-shared/constants";
import {OttoStatusData} from "../../../../otto-shared/otto-interfaces";

interface HierarchicalGroupData {
  id: string,
  name: string,
  status: {
    lights: {
      status: OttoObjectStatus
    },
    motion: {
      status: OttoObjectStatus
    }
  },
  lights: {
    id: string,
    name: string,
    type: string,
    group: HierarchicalGroupData
  }[],
  satellites: {
    id: string,
    ips: string[],
    name: string,
    group: HierarchicalGroupData,
    liveMotion: boolean,
    liveMotionTimeout: any
  }[]
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  OttoObjectStatus = OttoObjectStatus;
  model: {
    groups: HierarchicalGroupData[]
  }

  constructor(
    private apiService: ApiService,
    private router: Router
  ) { }

  async ngOnInit() {
    let unassignedGroup: HierarchicalGroupData = {
      id: '',
      name: 'Unassigned',
      lights: [],
      satellites: [],
      status: {
        lights: {
          status: OttoObjectStatus.Off
        },
        motion: {
          status: OttoObjectStatus.Off
        }
      }
    }
    let stuff = await this.apiService.getStuff();
    console.log(stuff);
    this.model = { groups: [] };
    for (let group of stuff.groups) {
      let status = {
        lights: {
          status: OttoObjectStatus.Off
        },
        motion: {
          status: OttoObjectStatus.Off
        }
      }
      let newGroup: HierarchicalGroupData = <HierarchicalGroupData>{
        ...<any>group,
        lights: [],
        satellites: [],
        status: status
      };
      this.model.groups.push(newGroup);
    }
    for (let light of stuff.lights) {
      let groupObj = this.model.groups.find(group => group.id === light.group);
      if (!groupObj) {
        unassignedGroup.lights.push(<any>{...light, group: groupObj});
      } else {
        groupObj.lights.push(<any>{...light, group: groupObj});
      }
    }
    for (let satellite of stuff.satellites) {
      let groupObj = this.model.groups.find(group => group.id === satellite.group);
      if (!groupObj) {
        unassignedGroup.satellites.push(<any>{...satellite, group: groupObj});
      } else {
        groupObj.satellites.push(<any>{...satellite, group: groupObj});
      }
    }
    if (unassignedGroup.satellites.length || unassignedGroup.lights.length) {
      this.model.groups.push(unassignedGroup);
    }

    let socket = this.apiService.socket;
    socket.on('status', (response: OttoStatusData) => {
      console.log('got status obj');
      console.log(response);
      for (let statusGroup of response.groups) {
        let modelGroup = this.model.groups.find(modelGroup => modelGroup.id === statusGroup.id);
        if (modelGroup) {
          // For now, if one light is on, the group light is on
          if (statusGroup.lights) {
            let atLeastOneOnLight = statusGroup.lights.find(light => light.status === OttoObjectStatus.On);
            if (atLeastOneOnLight) {
              modelGroup.status.lights.status = OttoObjectStatus.On;
            } else {
              modelGroup.status.lights.status = OttoObjectStatus.Off;
            }
          }

          // Motion is direct from the server
          if (statusGroup.motion) {
            modelGroup.status.motion.status = statusGroup.motion.status;
          }
        }
      }
    });
    socket.on('sat_mot', (idObj: {id: string, pirnum: number}) => {
      console.log('sat mot');
      if (this.model) {
        for (let group of this.model.groups) {
          group.satellites.forEach(satellite => {
            clearTimeout(satellite.liveMotionTimeout);
            satellite.liveMotion = true;
            satellite.liveMotionTimeout = setTimeout(() => {
              satellite.liveMotion = false;
            }, 6000);
          });
        }
      }
    });
    socket.emit('app_get_status');
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

  motionOffClicked(groupId: string) {
    this.apiService.socket.emit('app_motion_off', { group: groupId });
  }

  motionOnClicked(groupId: string) {
    this.apiService.socket.emit('app_motion_on', { group: groupId });
  }

  motionOnTempClicked(groupId: string) {
    this.apiService.socket.emit('app_motion_off_temp', { group: groupId });
  }

  toggleLightsForGroupClicked(group: HierarchicalGroupData) {
    if (group.status.lights.status === OttoObjectStatus.On) {
      this.apiService.socket.emit('app_group_lights_off', { group: group.id });
    } else {
      this.apiService.socket.emit('app_group_lights_on', { group: group.id });
    }
  }

  updateSatellitesDevClicked() {
    this.apiService.socket.emit('app_update_program_dev');
  }

  updateSatellitesProdClicked() {
    this.apiService.socket.emit('app_update_program_prod');
  }

  scanLightsClicked() {
    this.apiService.socket.emit('app_scan_lights');
  }

  ngOnDestroy() {
    let socket = this.apiService.socket;
    socket.off('status');
  }
}
