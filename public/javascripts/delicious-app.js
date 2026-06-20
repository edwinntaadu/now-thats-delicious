import "../sass/style.scss";

import { $, $$ } from "./modules/bling";
import autocomplete from "./modules/autocomplete";
import typeAhead from "./modules/typeAhead";
import makeMap from "./modules/map";

window.initMapAutocomplete = function () {
  autocomplete($("#address"), $("#lat"), $("#lng"));
  makeMap($("#map"));
};

typeAhead($(".search"));
