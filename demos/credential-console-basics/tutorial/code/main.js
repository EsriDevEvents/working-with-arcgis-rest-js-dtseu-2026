// #region imports
// Sign-in: the session it returns authenticates every other call
import { ArcGISIdentityManager } from "@esri/arcgis-rest-request";
import {
  // The signed-in user and their organization
  getSelf,
  // Projects are groups
  searchGroups,
  createGroup,
  updateGroup,
  removeGroup,
  // Credentials are items
  searchItems,
  getGroupContent, // items shared with a group
  updateItem,
  removeItem,
  shareItemWithGroup,
  // Builds search queries in readable code: tags:project AND owner:<you>
  SearchQueryBuilder,
} from "@esri/arcgis-rest-portal";
// API keys: the item plus its privileges, referrers and two key slots
import { createApiKey, getApiKey, updateApiKey, invalidateApiKey } from "@esri/arcgis-rest-developer-credentials";
// Sign-in options (client ID, redirect URL)
import { oauthOptions } from "./config.js";
// #endregion imports

// #region sign-in
// The signed-in session. Every REST JS call receives it as `authentication`.
let session;
// Kept in sessionStorage: survives a reload, cleared when the tab closes.
// Any script on the page can read it (XSS): in production keep tokens server-side (HttpOnly cookie)
const SESSION_KEY = "credential-console-basics-session";
// Shortcut for document.querySelector
const $ = (selector) => document.querySelector(selector);

$("#sign-in").addEventListener("click", async () => {
  try {
    // Opens the ArcGIS sign-in page in a popup (OAuth 2.0 with PKCE, no backend needed)
    session = await ArcGISIdentityManager.beginOAuth2(oauthOptions);
    sessionStorage.setItem(SESSION_KEY, session.serialize());
    // Next step: get the user and show it
    showSignedIn();
  } catch (error) {
    $("#status").textContent = `Sign-in failed: ${error.message}`;
  }
});
// #endregion sign-in

// #region get-self
async function showSignedIn() {
  // The signed-in user and the organization, in one request
  const self = await getSelf({ authentication: session });
  // Every call returns the plain JSON of the REST API
  console.log("getSelf()", self);
  const { username, fullName } = self.user;
  // The organization's own URL, e.g. https://<urlKey>.maps.arcgis.com
  portalHome = `https://${self.urlKey}.${self.customBaseUrl}`;
  // Swap "Sign in" for the user
  $("#sign-in").hidden = true;
  $("#sign-out").hidden = false;
  // Set the <calcite-navigation-user> Calcite component
  Object.assign($("#user"), { hidden: false, fullName, username });
  $("#new-project").disabled = false;
  // Next step: search the user's projects
  loadProjects();
}
// #endregion get-self

// #region search-groups
// Groups with this tag are projects, as in Credential Console
const projectTag = "project";
// Not a group: a first entry in the Projects column that lists every item you own
const ALL = { id: "all", title: "All API keys" };
// The user's projects (groups), as last returned by ArcGIS
let projects = [];

async function loadProjects() {
  // Readable query: tags:project AND owner:<you>
  const q = new SearchQueryBuilder().match(projectTag).in("tags").and().match(session.username).in("owner");
  console.log("query (q) used next in searchGroups", q);
  const response = await searchGroups({ q, num: 100, authentication: session });
  console.log("response", response);
  
  projects = response.results;
   
  selectProject(ALL.id); // It is the function that loads the items
  renderProjects(); // Print the list (see "Search credentials")
}
// #endregion search-groups

// Fills the Projects column: one entry per group, with Rename and Delete actions.
// renameProject and deleteProject come in the next steps; render and listItem are
// Calcite list helpers at the end of the file.
function renderProjects() {
  render($("#projects"), projects, (p) => p.snippet ?? "", [
    ["launch", "Open in ArcGIS", openPortalPage("group")],
    ["pencil", "Rename", renameProject],
    ["trash", "Delete", deleteProject],
  ]);
  $("#projects").prepend(listItem(ALL, "Every API key you own", []));
}

// #region create-group
$("#new-project").addEventListener("click", async () => {
  const title = prompt("Project name");
  if (!title) return;
  const { group } = await createGroup({
    group: { title, tags: [projectTag], access: "private" },
    authentication: session,
  });
  // Search takes a few seconds to see new groups: add it to the list ourselves
  projects.push(group);
  // Select it and load its items (none yet)
  selectProject(group.id);
  renderProjects();
});
// #endregion create-group

// #region update-group
async function renameProject(project) {
  const title = prompt("New project name", project.title);
  if (!title) return;
  // Only send the fields that change
  await updateGroup({ group: { id: project.id, title }, authentication: session });
  project.title = title;
  renderProjects();
}
// #endregion update-group


// The items of the selected project (ArcGIS response from last query)
let items = [];

// Runs each time a project is selected in the list
async function loadItems(project) {
  items = project === ALL ? await searchMyApiKeys() : await loadGroupItems(project);
  renderItems();
}

// #region search-credentials
async function searchMyApiKeys() {
  // Readable query: owner:<you> AND type:Application AND typekeywords:APIToken
  // Search takes a few seconds to see changes.
  const q = new SearchQueryBuilder()
    .match(session.username).in("owner")
    .and().match("Application").in("type") // every developer credential
    .and().match("APIToken").in("typekeywords"); // only API keys, not OAuth credentials
  const response = await searchItems({ q, num: 100, sortField: "modified", sortOrder: "desc", authentication: session });
  console.log("searchMyApiKeys response: ", response);
  return response.results;
}
// #endregion search-credentials

async function loadGroupItems(project) {
  // Items shared with the group
  const response = await getGroupContent(project.id, { authentication: session });
  return response.items;
}

// Fills the API keys column: one entry per item, with one action per next step
function renderItems() {
  // Shows the expiration dates once the Info action has read them, the item type until then
  render($("#items"), items, (i) => i.expires ?? i.type, [
    ["launch", "Open in ArcGIS", openPortalPage("item")],
    ["information", "Info", showApiKeyInfo],
    ["pencil", "Rename", renameItem],
    ["globe", "Referrers", updatePrivilegesAndReferrers],
    ["refresh", "Rotate", rotateApiKey],
    ["trash", "Delete", deleteItem],
  ]);
  $("#status").textContent = items.length ? "" : "No API keys yet. Create one.";
}

// #region get-api-key
async function showApiKeyInfo(item) {
  // The credential (privileges, referrers, which slots are active…) and its item, in one call.
  // It never includes the keys themselves, so it is safe to log.
  const apiKey = await getApiKey({ itemId: item.id, authentication: session });
  console.log(`getApiKey() "${item.title}"`, apiKey);
  // Expiration dates are item fields (milliseconds). Only active slots hold a key that expires.
  item.expires = [1, 2]
    .filter((slot) => apiKey[`apiToken${slot}Active`])
    .map((slot) => `Key ${slot} expires ${new Date(apiKey.item[`apiToken${slot}ExpirationDate`]).toLocaleDateString()}`)
    .join(" · ") || "No active keys";
  renderItems();
}
// #endregion get-api-key

// #region create-api-key
// What the keys of this demo can do: show basemaps
const privileges = ["premium:user:basemaps"];
// Keys always expire (one year at most). Here: in 30 days.
const in30Days = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

$("#new-item").addEventListener("click", async () => {
  const title = prompt("API key title");
  if (!title) return;
  // Creates the item, registers it as a credential and generates the key in slot 1
  const apiKey = await createApiKey({
    title,
    tags: ["credential-console-basics"],
    privileges,
    generateToken1: true,
    apiToken1ExpirationDate: in30Days(),
    authentication: session,
  });
  // The only time the key can be read: the app doesn't keep it
  prompt("Copy the API key now. It won't be shown again.", apiKey.accessToken1);
  // #region share-api-key
  // `selected` is the project selected in the list ("All API keys" is not a group)
  if (selected !== ALL) {
    // Share it with the selected project: that's how keys are organized by customer
    await shareItemWithGroup({ id: apiKey.itemId, groupId: selected.id, authentication: session });
  }
  // #endregion share-api-key
  items.push(apiKey.item);
  renderItems();
});
// #endregion create-api-key

// #region update-item
async function renameItem(item) {
  const title = prompt("New API key title", item.title);
  if (!title) return;
  // Title, tags and summary are item fields: changing them doesn't touch the keys.
  // Only send the fields that change.
  await updateItem({ item: { id: item.id, title }, authentication: session });
  item.title = title;
  renderItems();
}
// #endregion update-item

// #region update-api-key
async function updatePrivilegesAndReferrers(item) {
  const referrers = prompt("Websites allowed to use the key, comma separated (empty: any)", "https://*.example.com");
  if (referrers === null) return;
  // Privileges and referrers belong to the credential, not to the item: updateItem can't change them.
  // Each list replaces the previous one, so send it whole.
  await updateApiKey({
    itemId: item.id,
    privileges,
    httpReferrers: referrers.split(",").map((r) => r.trim()).filter(Boolean),
    authentication: session,
  });
  // Both keys stop working: the customer needs a new one (next step)
  $("#status").textContent = `"${item.title}" updated. Its keys no longer work: rotate it.`;
}
// #endregion update-api-key

// #region rotate-api-key
async function rotateApiKey(item) {
  // Which slot holds the key in use? The new key goes in the other one.
  const { apiToken1Active, apiToken2Active } = await getApiKey({ itemId: item.id, authentication: session });
  const [newSlot, oldSlot] = apiToken1Active ? [2, 1] : [1, 2];
  // 1. Generate the new key: the old one keeps working meanwhile
  const updated = await updateApiKey({
    itemId: item.id,
    [`generateToken${newSlot}`]: true,
    [`apiToken${newSlot}ExpirationDate`]: in30Days(),
    authentication: session,
  });
  // 2. The customer switches to the new key
  prompt(`New key in slot ${newSlot}. Copy it now: it won't be shown again.`, updated[`accessToken${newSlot}`]);
  // 3. Revoke the old key. It stops working in about a second.
  const oldKeyActive = oldSlot === 1 ? apiToken1Active : apiToken2Active;
  if (oldKeyActive && confirm(`Revoke the old key in slot ${oldSlot}?`)) {
    await invalidateApiKey({ itemId: item.id, apiKey: oldSlot, authentication: session });
  }
}
// #endregion rotate-api-key

// #region clean-up
async function deleteItem(item) {
  if (!confirm(`Delete API key "${item.title}"? Apps using it stop working.`)) return;
  await removeItem({ id: item.id, authentication: session });
  items = items.filter((i) => i.id !== item.id);
  renderItems();
}

async function deleteProject(project) {
  if (!confirm(`Delete project "${project.title}"? Its API keys stay in your content.`)) return;
  await removeGroup({ id: project.id, authentication: session });
  projects = projects.filter((p) => p.id !== project.id);
  // Back to "All API keys"
  selectProject(ALL.id);
  renderProjects();
}
// #endregion clean-up

// --- UI plumbing: not part of the steps ---

// The project selected in the Projects column
let selected;

function selectProject(id) {
  selected = id === ALL.id ? ALL : projects.find((p) => p.id === id);
  $("#new-item").disabled = !selected;
  $("#items-panel").description = selected ? selected.title : "Select a project";
  items = [];
  renderItems();
  if (selected) loadItems(selected);
}

$("#projects").addEventListener("calciteListChange", (event) => {
  selectProject(event.target.selectedItems[0]?.value);
});

$("#sign-out").addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  location.reload();
});

// A failed request shows its message (never log the whole error: it can hold credentials)
addEventListener("unhandledrejection", (event) => {
  $("#status").textContent = `Error: ${event.reason?.message ?? event.reason}`;
});

// The organization's URL, set from getSelf() at sign-in
let portalHome;

// Opens the group or item page in the organization, to check the changes there
function openPortalPage(page) {
  return (record) => open(`${portalHome}/home/${page}.html?id=${record.id}`, "_blank");
}

// Generic list rendering, shared by projects and items
function render(list, records, describe, actions) {
  list.replaceChildren(...records.map((record) => listItem(record, describe(record), actions)));
}

function listItem(record, description, actions) {
  const element = document.createElement("calcite-list-item");
  Object.assign(element, { label: record.title, description, value: record.id, selected: record.id === selected?.id });
  for (const [icon, text, onClick] of actions) {
    const action = Object.assign(document.createElement("calcite-action"), { icon, text, slot: "actions-end" });
    action.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick(record);
    });
    element.append(action);
  }
  return element;
}

// Signed in before? Restore the session saved at sign-in (runs last: everything above is ready)
const saved = sessionStorage.getItem(SESSION_KEY);
if (saved) {
  session = ArcGISIdentityManager.deserialize(saved);
  showSignedIn();
}
