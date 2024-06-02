function startPreview(video) {
  video.children[0].setAttribute("src", video.children[0].getAttribute("src_tmp"));
  video.muted = true;
  video.currentTime = 5;
  video.load();
  video.play();
}

function stopPreview(video) {
  video.pause()
}

window.onload = function () {
  console.log("Document finished loading!");
  for (video of document.getElementsByClassName("video-preview")) {
    video.addEventListener("mouseenter", (event) => startPreview(event.target));
    video.addEventListener("mouseleave", (event) => stopPreview(event.target));
  }
  if (document.URL.includes("/video/")) {
    setup_labels();
    setup_label_tracking();
    setup_age_tracking();
  }
}

function label_exists(label, selector) {
  for (existing_label of selector.options) {
    if (label === existing_label.value) {
      return true;
    }
  }
  return false;
}

function setup_label_tracking() {
  document.getElementById("label-choice").onchange = function (e) {
    console.log(e);
    var chosen_labels = Array.from(e.target.options).filter(function (option) { return option.selected; });
    console.log(chosen_labels);
    xhr = new XMLHttpRequest()
    xhr.open("POST", "/addVideoLabel/", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    var labels = chosen_labels.map(function (option) { return option.value });
    var post_data = { "labels": labels };
    post_data["video_id"] = document.URL.split("/")[4];
    console.log(post_data);
    console.log(JSON.stringify(post_data));
    for (label in chosen_labels) {
      xhr.send(JSON.stringify(post_data));
    }
  }

}

function setup_age_tracking() {
  document.getElementById("video-info-age").onchange = function (e) {
    var age = e.target.value;
    xhr = new XMLHttpRequest()
    xhr.open("POST", "/changeAge/", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    var post_data = { "age": age };
    post_data["video_id"] = document.URL.split("/")[4];
    xhr.send(JSON.stringify(post_data));
  }
}
function addfav(button) {
  const Http = new XMLHttpRequest();
  const url = "/fav/" + document.URL.split("/")[4] + "/";
  Http.open("GET", url);
  Http.send();
  console.log(button);
  button.setAttribute("onClick", "remfav(this)");
  button.setAttribute("id", "rem-fav");
  button.children[0].setAttribute("class", "fa fa-heart");
}
function remfav(button) {
  const Http = new XMLHttpRequest();
  const url = "/remfav/" + document.URL.split("/")[4] + "/";
  Http.open("GET", url);
  Http.send();
  console.log(button);
  button.setAttribute("onClick", "addfav(this)");
  button.setAttribute("id", "add-fav");
  button.children[0].setAttribute("class", "fa fa-heart-o");
}
function remvid(button) {
  const xhr = new XMLHttpRequest();
  var video_id = document.URL.split("/")[4];
  xhr.open("POST", "/remvid/", true);
  xhr.setRequestHeader("Content-Type", "application/json");
  var post_data = { "video_id": video_id };
  xhr.send(JSON.stringify(post_data));
  window.location.href = "/";
}

function setup_labels() {
  var selector = document.getElementById("label-choice");
  var labels = JSON.parse(JSON.parse(document.querySelector("#labels").text));
  console.log(selector);
  for (label of labels) {
    var opt = document.createElement("option");
    opt.value = label.fields.label;
    opt.innerHTML = label.fields.label;
    if (!label_exists(label.fields.label, selector)) {
      selector.appendChild(opt);
    }
  }
}