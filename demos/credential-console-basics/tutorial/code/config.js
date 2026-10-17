// #region config
// OAuth options, shared by main.js (beginOAuth2) and callback.html (completeOAuth2)
export const oauthOptions = {
  // Client ID of your OAuth credentials
  clientId: "YOUR_CLIENT_ID", // @var clientId
  // ArcGIS Online and ArcGIS Location Platform accounts sign in here
  portal: "https://www.arcgis.com/sharing/rest",
  // callback.html, next to this page. Register this exact URL in your OAuth credentials.
  redirectUri: new URL("callback.html", location.href).href,
  // Sign in in a popup, so the app stays on screen
  popup: true,
};
// #endregion config
