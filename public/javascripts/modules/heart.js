import axios from "axios";
import { $ } from "./bling";

function announce(message) {
  const status = $("#app-status");
  if (status) status.textContent = message;
}

async function ajaxHeart(event) {
  event.preventDefault();

  const button = this.querySelector(".heart__button");
  const storeName = button?.dataset.storeName || "Store";

  if (!button) return;

  button.disabled = true;
  button.setAttribute("aria-busy", "true");

  try {
    const { data: user } = await axios.post(this.action);
    const isHearted = button.classList.toggle("heart__button--hearted");
    const heartCount = $(".heart-count");

    if (heartCount) heartCount.textContent = user.hearts.length;

    button.setAttribute(
      "aria-label",
      isHearted
        ? `Remove ${storeName} from saved stores`
        : `Save ${storeName}`,
    );
    button.setAttribute("aria-pressed", String(isHearted));
    button.title = isHearted ? "Remove from saved stores" : "Save store";

    announce(
      isHearted
        ? `${storeName} was saved.`
        : `${storeName} was removed from saved stores.`,
    );

    if (isHearted) {
      button.classList.add("heart__button--float");
      window.setTimeout(
        () => button.classList.remove("heart__button--float"),
        1200,
      );
    }
  } catch (error) {
    console.error(error);
    announce(`${storeName} could not be updated. Please try again.`);
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

export default ajaxHeart;
