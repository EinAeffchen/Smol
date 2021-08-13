// variable that keeps all the filter information

var send_data = {}

$(document).ready(function () {
  

  // reset all parameters on page load

  resetFilters();
  // bring all the data without any filters

  getAPIData();
  // get all countries from database via 

  // sort the data according to price/points

  $('#id_filter_videos').on('change', function () {
    send_data['sort_by'] = this.value;
    getAPIData();
  });

})


/**
    Function that resets all the filters   
**/
function resetFilters() {
  $("#sort_by").value = "rating";
  if ($("#ajax-url").attr("portal").length > 0) {
    var portal = $("#ajax-url").attr("portal")
    send_data["portal"] = portal;
  }
  else if ($("#ajax-url").attr("tag").length > 0) {
    var tag = $("#ajax-url").attr("tag")
    send_data["tag"] = tag;
  }
  else if ($("#ajax-url").attr("category").length > 0) {
    var category = $("#ajax-url").attr("category")
    send_data["category"] = category;
  }
  else if ($("#ajax-url").attr("search").length > 0) {
    var search = $("#ajax-url").attr("search")
    send_data["search"] = search;
  }

  send_data["sort_by"] = 'rating';
  send_data['format'] = 'json';
}

/**.
    Utility function to showcase the api data 
    we got from backend to the table content
**/
function putTableData(result) {
  // creating table row for each result and

  // pushing to the html cntent of table body of listing table

  let row;
  if (result["results"].length > 0) {
    $("#no_results").hide();
    $("#list_data").show();
    $("#listing").html("");
    $.each(result["results"], function (a, b) {
      var title = b.title
      title = title.substring(0, 60);
      row = '<div class="card card-body w-lg-20 w-md-20">' +
        '<a href = "/video/' + b.id + '/" %}">' +
        '<img src = "' + b.preview_img + '" name = \'preview-' + b.id + '\' alt = "' + title + '"' +
        'style = "width:100%" class="zoom max-auto img-fluid img-thumbnail" onerror = "recheck(this)">' +
        '</a>' +
        '<div class="caption">' +
        '<p>' + title + '</p>' +
        '</div>' +
        '</div>'
      $("#listing").append(row);
    });
    var count = Humanize.intComma(result["count"])
    $("#count").html(count + " Results for:")
  }
  else {
    // if no result found for the given filter, then display no result

    $("#no_results h5").html("No results found");
    $("#list_data").hide();
    $("#no_results").show();
  }
  // setting previous and next page url for the given result

  let first_url = result["links"]["first"];
  let prev_url = result["links"]["previous"];
  let current = result["links"]["current"];
  let next_url = result["links"]["next"];
  let last_url = result["links"]["last"];
  let total = result["total_pages"];
  // disabling-enabling button depending on existence of next/prev page. 

  if (prev_url === null) {
    $("#previous").addClass("disabled");
    $("#previous").prop('disabled', true);
    $("#first").addClass("disabled");
    $("#first").prop('disabled', true);
  } else {
    $("#previous").removeClass("disabled");
    $("#previous").prop('disabled', false);
    $("#first").removeClass("disabled");
    $("#first").prop('disabled', false);
  }
  if (next_url === null) {
    $("#next").addClass("disabled");
    $("#next").prop('disabled', true);
    $("#last").addClass("disabled");
    $("#last").prop('disabled', true);
  } else {
    $("#next").removeClass("disabled");
    $("#next").prop('disabled', false);
    $("#last").removeClass("disabled");
    $("#last").prop('disabled', false);
  }
  // setting the url

  $("#first").attr("url", first_url);
  $("#previous").attr("url", prev_url);
  $("#current").html("Page " + Humanize.intComma(current) + " of " + Humanize.intComma(total))
  $("#next").attr("url", next_url);
  $("#last").attr("url", last_url);
  // displaying result count

  
  $(".fancybox").fancybox({
    openEffect: "none",
    closeEffect: "none"
  });

  $(".zoom").hover(function () {

    $(this).addClass('transition');
  }, function () {

    $(this).removeClass('transition');
  });
}

function getAPIData() {
  let url = $('#ajax-url').attr("url")
  $.ajax({
    method: 'GET',
    url: url,
    data: send_data,
    beforeSend: function () {
      $("#no_results h5").html("Loading data...");
    },
    success: function (result) {
      putTableData(result);
    },
    error: function (response) {
      $("#no_results h5").html("Something went wrong");
      $("#list_data").hide();
    }
  });
}

$("#next").click(function () {
  // load the next page data and 

  // put the result to the table body

  // by making ajax call to next available url

  let url = $(this).attr("url");
  if (!url)
    $(this).prop('all', true);

  $(this).prop('all', false);
  $.ajax({
    method: 'GET',
    url: url,
    success: function (result) {
      putTableData(result);
    },
    error: function (response) {
      console.log(response)
    }
  });
})

$("#previous").click(function () {
  // load the previous page data and 

  // put the result to the table body 

  // by making ajax call to previous available url

  let url = $(this).attr("url");
  if (!url)
    $(this).prop('all', true);

  $(this).prop('all', false);
  $.ajax({
    method: 'GET',
    url: url,
    success: function (result) {
      putTableData(result);
    },
    error: function (response) {
      console.log(response)
    }
  });
})

$("#first").click(function () {
  // load the next page data and 

  // put the result to the table body

  // by making ajax call to next available url

  let url = $(this).attr("url");
  if (!url)
    $(this).prop('all', true);

  $(this).prop('all', false);
  $.ajax({
    method: 'GET',
    url: url,
    success: function (result) {
      putTableData(result);
    },
    error: function (response) {
      console.log(response)
    }
  });
})

$("#last").click(function () {
  // load the next page data and 

  // put the result to the table body

  // by making ajax call to next available url

  let url = $(this).attr("url");
  if (!url)
    $(this).prop('all', true);

  $(this).prop('all', false);
  $.ajax({
    method: 'GET',
    url: url,
    success: function (result) {
      putTableData(result);
    },
    error: function (response) {
      console.log(response)
    }
  });
})