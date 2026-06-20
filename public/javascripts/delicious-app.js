import "../sass/style.scss";

import { $, $$ } from "./modules/bling";
import autocomplete from "./modules/autocomplete";
import typeAhead from "./modules/typeAhead";

window.initMapAutocomplete = function () {
  autocomplete($("#address"), $("#lat"), $("#lng"));
};

typeAhead($(".search"));
