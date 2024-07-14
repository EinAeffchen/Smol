function startPreview(video) {
  video.children[0].setAttribute(
    "src",
    video.children[0].getAttribute("src_tmp")
  );
  video.muted = true;
  video.currentTime = 5;
  video.load();
  video.play();
}

function stopPreview(video) {
  video.pause();
}

window.onload = function () {
  if (document.URL.includes("/video/")) {
    setup_label_tracking();
  }
  for (video of document.getElementsByClassName("video-preview")) {
    video.addEventListener("mouseenter", (event) => startPreview(event.target));
    video.addEventListener("mouseleave", (event) => stopPreview(event.target));
  }
};

function label_exists(label, selector) {
  for (existing_label of selector.options) {
    if (label === existing_label.value) {
      return true;
    }
  }
  return false;
}

function setup_label_tracking() {
  document.getElementById("id_labels").onchange = function (e) {
    var chosen_labels = Array.from(e.target.options).filter(function (option) {
      return option.selected;
    });
    console.log(chosen_labels);
    xhr = new XMLHttpRequest();
    xhr.open("POST", "/addVideoLabel/", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    var labels = chosen_labels.map(function (option) {
      return option.value;
    });
    var post_data = { labels: labels };
    post_data["video_id"] = document.URL.split("/")[4];
    console.log(post_data);
    console.log(JSON.stringify(post_data));
    for (label in chosen_labels) {
      xhr.send(JSON.stringify(post_data));
    }
  };
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
async function analyze() {
  let loader = document.getElementById("load-icon");
  loader.style.display = "none";
  loader.innerHTML =
    '<i class="fa fa-spinner fa-spin"></i> Running face recognition. Depening on your library size, this might take a while';
  loader.style.display = "block";
  console.log(loader);
  const response = await fetch("/analyze/", {
    method: "POST",
    body: JSON.stringify({ video_id: document.URL.split("/")[4] }),
  });
  console.log(response);
  loader.innerHTML = '<i class="fa fa-check" aria-hidden="true"></i> Done';
  location.reload();
}
// TODO add new element instead of reusing loader
async function deleteEncoding(button) {
  let loader = document.getElementById("load-icon");
  loader.style.display = "none";
  loader.innerHTML =
    '<i class="fa fa-spinner fa-spin"></i> Deleting recognition data...';
  loader.style.display = "block";
  const response = await fetch("/delete-encoding/", {
    method: "POST",
    body: JSON.stringify({ video_id: document.URL.split("/")[4] }),
  });
  loader.innerHTML =
    '<i class="fa fa-check" aria-hidden="true"></i> Deleted Recognition data!';
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
  var post_data = { video_id: video_id };
  xhr.send(JSON.stringify(post_data));
  window.location.href = "/";
}
async function remmeta(button) {
  const response = await fetch("/remmeta/", {
    method: "POST",
    body: JSON.stringify({ video_id: document.URL.split("/")[4] }),
  });
  const output = await response;
  console.log(output);
  window.location.href = "/";
}
