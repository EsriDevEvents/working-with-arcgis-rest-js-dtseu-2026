// #region config
// callback.html, next to this page. Register this exact URL in your OAuth credentials.
const clientId = "YOUR_CLIENT_ID"; // @var clientId
const redirectUri = new URL("callback.html", location.href).href;
console.log("redirectUri", redirectUri);

// OAuth options, shared by main.js (beginOAuth2) and callback.html (completeOAuth2)
export const oauthOptions = {
  // Client ID of your OAuth credentials
  clientId,
  redirectUri,
  
  // Set if you need to authenticate against ArcGIS Enterprise
  // portal: "https://<host>/<webadaptor>/sharing/rest", // Defaults to: https://www.arcgis.com/sharing/rest
  
  // Sign in in a popup , so the app stays on screen
  // popup: true
};
// #endregion config
