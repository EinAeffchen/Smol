function load_videos(videos) {
  console.log(videos);
  for (let video of videos) {
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
          response["thumbnail"]
        );
        info_box.innerHTML = count_block.innerHTML;
      });
  }
}

class DocumentCount {
  constructor(file_count) {
    this.innerHTML = `<div>
    Found ${file_count} new files. Start processing...
  </div>`;
  }
}

class ImportedDocument {
  constructor(filename, preview) {
    this.innerHTML = `<div>Imported ${filename}. <br><img src='/static/thumbnails/${preview}'></div>`;
  }
}

function get_new_videos() {
  let load_icon = document.getElementById("load-icon");
  load_icon.style.display = "block";
  fetch("/get-new-videos/")
    .then((response) => console.log(response) || response.json())
    .then(function (response) {
      const info_box = document.querySelector("#info-box");
      let count_block = new DocumentCount(response["count"]);
      info_box.innerHTML = count_block.innerHTML;
      load_videos(response["paths"]);
      load_icon.style.display = "none";
    });
}
