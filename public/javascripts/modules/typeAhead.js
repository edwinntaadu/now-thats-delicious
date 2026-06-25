import axios from "axios";

const SEARCH_DELAY = 250;

function announce(message) {
  const status = document.querySelector("#app-status");
  if (status) status.textContent = message;
}

function typeAhead(search) {
  if (!search) return;

  const searchInput = search.querySelector('input[name="search"]');
  const searchResults = search.querySelector(".search__results");

  if (!searchInput || !searchResults) return;

  let requestController;
  let searchTimer;
  let activeIndex = -1;

  function getOptions() {
    return [...searchResults.querySelectorAll('[role="option"]')];
  }

  function closeResults({ clear = false } = {}) {
    if (clear) searchResults.replaceChildren();
    getOptions().forEach((option) => {
      option.classList.remove("search__result--active");
      option.setAttribute("aria-selected", "false");
    });
    searchResults.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  }

  function openResults() {
    searchResults.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  }

  function setActiveOption(index) {
    const options = getOptions();
    if (!options.length) return;

    activeIndex = (index + options.length) % options.length;

    options.forEach((option, optionIndex) => {
      const isActive = optionIndex === activeIndex;
      option.classList.toggle("search__result--active", isActive);
      option.setAttribute("aria-selected", String(isActive));
    });

    const activeOption = options[activeIndex];
    searchInput.setAttribute("aria-activedescendant", activeOption.id);
    activeOption.scrollIntoView({ block: "nearest" });
  }

  function showMessage(message, state) {
    const result = document.createElement("div");
    result.className = `search__message search__message--${state}`;
    result.setAttribute("role", "status");
    result.textContent = message;
    searchResults.removeAttribute("role");
    searchResults.replaceChildren(result);
    openResults();
  }

  function showStores(stores) {
    const fragment = document.createDocumentFragment();

    stores.forEach((store, index) => {
      const result = document.createElement("a");
      result.id = `site-search-option-${index}`;
      result.className = "search__result";
      result.href = `/stores/${encodeURIComponent(store.slug)}`;
      result.setAttribute("role", "option");
      result.setAttribute("aria-selected", "false");

      const name = document.createElement("strong");
      name.className = "search__result-name";
      name.textContent = store.name;
      result.appendChild(name);

      if (store.location?.address) {
        const address = document.createElement("span");
        address.className = "search__result-address";
        address.textContent = store.location.address;
        result.appendChild(address);
      }

      fragment.appendChild(result);
    });

    searchResults.setAttribute("role", "listbox");
    searchResults.replaceChildren(fragment);
    activeIndex = -1;
    openResults();
    announce(`${stores.length} search ${stores.length === 1 ? "result" : "results"} available.`);
  }

  async function searchStores(query) {
    requestController?.abort();
    requestController = new AbortController();
    showMessage("Searching…", "loading");

    try {
      const { data: stores } = await axios.get("/api/search", {
        params: { q: query },
        signal: requestController.signal,
      });

      if (searchInput.value.trim() !== query) return;

      if (stores.length) {
        showStores(stores);
      } else {
        showMessage(`No stores found for “${query}”.`, "empty");
        announce(`No stores found for ${query}.`);
      }
    } catch (error) {
      if (error.code === "ERR_CANCELED") return;
      console.error(error);
      showMessage("Search is unavailable. Please try again.", "error");
      announce("Store search is unavailable.");
    }
  }

  searchInput.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    const query = searchInput.value.trim();

    if (!query) {
      requestController?.abort();
      closeResults({ clear: true });
      return;
    }

    searchTimer = window.setTimeout(() => searchStores(query), SEARCH_DELAY);
  });

  searchInput.addEventListener("keydown", (event) => {
    const options = getOptions();

    if (event.key === "Escape") {
      closeResults();
      return;
    }

    if (!options.length || searchResults.hidden) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveOption(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveOption(activeIndex - 1);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      options[activeIndex].click();
    }
  });

  searchInput.addEventListener("focus", () => {
    if (searchResults.children.length) openResults();
  });

  document.addEventListener("click", (event) => {
    if (!search.contains(event.target)) closeResults();
  });
}

export default typeAhead;
