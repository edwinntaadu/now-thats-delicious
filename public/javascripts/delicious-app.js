import "../sass/style.scss";

import { $, $$ } from "./modules/bling";
import autocomplete from "./modules/autocomplete";

window.initMapAutocomplete = function () {
  autocomplete($("#address"), $("#lat"), $("#lng"));
};
