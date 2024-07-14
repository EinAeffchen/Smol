function load_video(video) {
  console.log(video);
  fetch("/load-video/", {
    method: "POST",
    body: JSON.stringify({ path: video }),
  })
    .then((response) => response.json())
    .then(function (response) {
      console.log(response);
      const info_box = document.querySelector("#info-box");
      let count_block = new ImportedDocument(
        response["file"],
        response["thumbnail"],
        response["id"]
      );
      info_box.innerHTML = count_block.innerHTML;
    });
}

class DocumentCount {
  constructor(count) {
    this.innerHTML = `<div>
    Found ${count} videos. Start processing...
  </div>`;
  }
}

class ImportedDocument {
  constructor(filename, preview, id) {
    this.innerHTML = `<div>Imported ${filename}. <br><a href="/video/${id}/"><img src='/static/thumbnails/${preview}'></a></div>`;
  }
}

function get_new_video() {
  let load_icon = document.getElementById("load-icon");
  load_icon.style.display = "block";
  fetch("/get-new-videos/")
    .then((response) => console.log(response) || response.json())
    .then(function (response) {
      const info_box = document.querySelector("#info-box");
      if (response["paths"]) {
        let count_block = new DocumentCount(response["count"]);
        info_box.innerHTML = count_block.innerHTML;
        for (video of response["paths"]) {
          load_video(video);
        }
        load_icon.style.display = "none";
      }
    });
}
