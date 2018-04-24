import { Component, OnInit } from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Subscription} from "rxjs/Subscription";
import {OttoGroup} from "../../../../otto-shared/otto-interfaces";
import {ApiService} from "../api/api.service";
import {OttoItemType} from "../../../../otto-shared/constants";

@Component({
  selector: 'app-group',
  templateUrl: './group.component.html',
  styleUrls: ['./group.component.scss']
})
export class GroupComponent implements OnInit {

  sub: Subscription;
  editingGroup: OttoGroup;

  constructor(
    public router: Router,
    public activatedRoute: ActivatedRoute,
    private apiService: ApiService
  ) { }

  async ngOnInit() {
    this.sub = this.activatedRoute.params.subscribe(async (params) => {
      let groupId = params && params['id'];
      if (!groupId) {
        this.editingGroup = {
          id: '',
          name: '',
          lightTimeout: 3 * 60 * 1000
        }
      } else {
        console.log(groupId);
        let group: OttoGroup = <OttoGroup> await this.apiService.getItemById(OttoItemType.Group, groupId);
        this.editingGroup = {...group};
      }
    });
  }

  ngOnDestroy() {
    this.sub && this.sub.unsubscribe();
  }

  async saveClicked() {
    let result = await this.apiService.saveGroup(this.editingGroup.id, this.editingGroup.name);
    console.log(result);
    this.router.navigate(['../']);
  }

  cancelClicked() {
    this.router.navigate(['../']);
  }

}
