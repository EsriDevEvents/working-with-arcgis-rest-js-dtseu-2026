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
  createItem,
  updateItem,
  removeItem,
  shareItemWithGroup,
  // Builds search queries in readable code: tags:project AND owner:<you>
  SearchQueryBuilder,
} from "@esri/arcgis-rest-portal";
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
  const { username , fullName } = self.user;
  console.log(`typeof(self.user) = ${typeof(self.user)} | self.user = user | username = username `);
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
const ALL = { id: "all", title: "All items" };
// The user's projects (groups), as last returned by ArcGIS
let projects = [];

async function loadProjects() {
  // Readable query: tags:project AND owner:<you>
  const q = new SearchQueryBuilder().match(projectTag).in("tags").and().match(session.username).in("owner");
  console.log("query (q) used next in searchGroup", q);
  const response = await searchGroups({ q, num: 100, authentication: session });
  console.log("response", response);
  
  projects = response.results;
   
  selectProject(ALL.id); // Select/Highlight "All items" in the UI
  renderProjects(); // Load its items (see "Search credentials")
}

// Fills the Projects column: one entry per group, with Rename and Delete actions.
// renameProject and deleteProject come in the next steps; render and listItem are
// Calcite list helpers at the end of the file.
function renderProjects() {
  render($("#projects"), projects, (p) => p.snippet ?? "", [
    ["pencil", "Rename", renameProject],
    ["trash", "Delete", deleteProject],
  ]);
  $("#projects").prepend(listItem(ALL, "Everything you own", []));
}
// #endregion search-groups

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

// #region remove-group
async function deleteProject(project) {
  if (!confirm(`Delete project "${project.title}"? Its items stay in your content.`)) return;
  await removeGroup({ id: project.id, authentication: session });
  projects = projects.filter((p) => p.id !== project.id);
  // Back to "All items"
  selectProject(ALL.id);
  renderProjects();
}
// #endregion remove-group

// #region search-items
// The items of the selected project, as last returned by ArcGIS
let items = [];

// Runs each time a project is selected in the list
async function loadItems(project) {
  items = project === ALL ? await searchMyItems() : await loadGroupItems(project);
  renderItems();
}

async function searchMyItems() {
  // Readable query: owner:<you>. Search takes a few seconds to see changes.
  const q = new SearchQueryBuilder().match(session.username).in("owner");
  const response = await searchItems({ q, num: 100, sortField: "modified", sortOrder: "desc", authentication: session });
  return response.results;
}

async function loadGroupItems(project) {
  // Items shared with the group
  const response = await getGroupContent(project.id, { authentication: session });
  return response.items;
}

// Fills the Items column: one entry per item, with Rename and Delete actions.
// renameItem and deleteItem come in the next steps.
function renderItems() {
  render($("#items"), items, (i) => i.type, [
    ["pencil", "Rename", renameItem],
    ["trash", "Delete", deleteItem],
  ]);
  $("#status").textContent = items.length ? "" : "No items yet. Create one.";
}
// #endregion search-items

// #region create-item
$("#new-item").addEventListener("click", async () => {
  const title = prompt("Item title");
  if (!title) return;
  // An item is the unit of content: title, type, tags… and here, a link
  const { id } = await createItem({
    item: { title, type: "Document Link", url: "https://developers.arcgis.com/arcgis-rest-js/", tags: ["credential-console-basics"] },
    authentication: session,
  });
  // #region share-item
  // `selected` is the project selected in the list ("All items" is not a group)
  if (selected !== ALL) {
    // Share it with the selected project: that's how items are organized
    await shareItemWithGroup({ id, groupId: selected.id, authentication: session });
  }
  items.push({ id, title, type: "Document Link" });
  renderItems();
  // #endregion share-item
});
// #endregion create-item

// #region update-item
async function renameItem(item) {
  const title = prompt("New item title", item.title);
  if (!title) return;
  // Only send the fields that change
  await updateItem({ item: { id: item.id, title }, authentication: session });
  item.title = title;
  renderItems();
}
// #endregion update-item

// #region remove-item
async function deleteItem(item) {
  if (!confirm(`Delete item "${item.title}"?`)) return;
  await removeItem({ id: item.id, authentication: session });
  items = items.filter((i) => i.id !== item.id);
  renderItems();
}
// #endregion remove-item

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
