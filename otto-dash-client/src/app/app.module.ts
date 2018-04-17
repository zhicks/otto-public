import { BrowserModule } from '@angular/platform-browser';
import {ModuleWithProviders, NgModule} from '@angular/core';


import { AppComponent } from './app.component';
import { ApiService } from "./api/api.service";
import {HttpModule} from "@angular/http";
import {RouterModule} from "@angular/router";
import {HomeComponent} from "./home/home.component";
import {GroupComponent} from "./group/group.component";
import {FormsModule} from "@angular/forms";
import {SatelliteComponent} from "./satellite/satellite.component";
import {LightComponent} from "./light/light.component";

const routing: ModuleWithProviders = RouterModule.forRoot([
  {
    path: 'home',
    component: HomeComponent
  },
  {
    path: 'group',
    component: GroupComponent
  },
  {
    path: 'group/:id',
    component: GroupComponent
  },
  {
    path: 'satellite',
    component: SatelliteComponent
  },
  {
    path: 'satellite/:id',
    component: SatelliteComponent
  },
  {
    path: 'light',
    component: LightComponent
  },
  {
    path: 'light/:id',
    component: LightComponent
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  }
]);

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    GroupComponent,
    SatelliteComponent,
    LightComponent
  ],
  imports: [
    BrowserModule,
    HttpModule,
    routing,
    FormsModule
  ],
  providers: [
    ApiService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
