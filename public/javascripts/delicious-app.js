import "../sass/style.scss";

import { $, $$ } from "./modules/bling";
import autocomplete from "./modules/autocomplete";
import typeAhead from "./modules/typeAhead";
import makeMap from "./modules/map";
import ajaxHeart from "./modules/heart";
import feedback from "./modules/feedback";

window.initMapAutocomplete = async function () {
  await Promise.allSettled([
    autocomplete($("#address"), $("#lat"), $("#lng")),
    makeMap($("#map")),
  ]);
};

typeAhead($(".search"));
feedback();

const heartForms = $$("form.heart");
heartForms.on("submit", ajaxHeart);
