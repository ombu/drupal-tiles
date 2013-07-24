(function ($) {
  Drupal.behaviors.tiles = {
    attach: function(context, settings) {
      $(Tile.prototype.selector.moveLink, context).click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        $(e.target).blur();
        if ($(e.target).closest(Tile.prototype.selector.tile).hasClass('dragging')) {
          return;
        }
        block = new Tile(e.target);
        block.setDraggable();
      });

      $(Tile.prototype.selector.resizeLink, context).once('block-width', function() {
        $(this).click(function(e) {
          e.preventDefault();
          e.stopPropagation();
          $(e.target).blur();
          if ($(e.target).closest(Tile.prototype.selector.tile).hasClass('dragging')) {
            return;
          }
          block = new Tile(e.target);
          block.setResizable();
        });
      });
    }
  };

  /**
   * @class Tile
   *   Encapsulate js functionality for a tile.
   */

  Tile = function(domNode) {
    $d = $(domNode);
    this.domNode = $d.attr('data-type') === 'block' ? $d : $d.closest(this.selector.tile);
    // Close the contextual links.
    this.domNode.closest('.contextual-links-region').mouseleave();
    this.region = this.domNode.closest(this.selector.region);
    this.module = this.domNode.attr('data-module');
    this.delta = this.domNode.attr('data-delta');
    this.width = parseInt(this.domNode.attr('data-width'), 10);;
  };

  Tile.prototype.selector = {
    tile: '.tile',
    region: '[data-type="region"],[data-type="section"]',
    moveLink: '.contextual-links .block-arrange a',
    resizeLink: '.contextual-links .block-set-width a'
  };

  Tile.prototype.setDraggable = function() {
    this.domNode.addClass('dragging');
    $('body').addClass('dragging');
    this.addMoveOverlay();
    return this;
  };

  Tile.prototype.unsetDraggable = function() {
    this.domNode.removeClass('dragging');
    $('body').removeClass('dragging');
    this.removeMoveOverlay();
    return this;
  };

  Tile.prototype.setInProgress = function() {
    this.domNode.addClass('in-progress');
    return this;
  };

  Tile.prototype.unsetInProgress = function() {
    this.domNode.removeClass('in-progress');
    return this;
  };

  /**
   * TODO Use jQuery template
   */
  Tile.prototype.addMoveOverlay = function() {
    // Prevent irresponsible js plugins (twitter I'm looking at you) from using
    // document.write after a block is moved. Using document.write after a page
    // load overwrites the whole dom.
    document.write = function() {};

    var overlayContent = '<button class="move-left">Left</button>';
    overlayContent += '<button class="move-right">Right</button>';
    overlayContent += '<button class="save">Save</button>';
    overlayContent += '<span class="cancel">Cancel</span>';
    this.domNode.prepend('<div class="tile-overlay"><div class="inner"><div class="control-wrapper">' + overlayContent + '</div></div></div>');
    $('.move-left', this.domNode).click($.proxy(this,'moveLeft'));
    $('.move-right', this.domNode).click($.proxy(this,'moveRight'));
    $('.cancel', this.domNode).click($.proxy(this, 'moveCancel'));
    $('.save', this.domNode).click($.proxy(this, 'saveManifest'));
    return this;
  };

  Tile.prototype.removeMoveOverlay = function() {
    $('.tile-overlay', this.domNode).remove();
    return this;
  };

  Tile.prototype.moveLeft = function(e) {
    var manifest = this.regionManifest();
    if (manifest.blocks[0].module === this.module &&
        manifest.blocks[0].delta === this.delta) {
      alert('This is already the first block in this region.');
      return false;
    }
    this.setInProgress();
    var tile_index = manifest.blockIndex[this.module + '-' + this.delta];
    var prev_tile_index = tile_index - 1;
    var tile_weight = manifest.blocks[tile_index].weight;
    manifest.blocks[tile_index].weight = manifest.blocks[prev_tile_index].weight;
    manifest.blocks[prev_tile_index].weight = tile_weight;
    this.requestRegion(manifest, $.proxy(function() {
      $("[data-module='" + this.module + "'][data-delta='" + this.delta + "'] " + this.selector.moveLink  + ':eq(0)').click();
    }, this));
    return false;
  };

  Tile.prototype.moveRight = function(e) {
    var manifest = this.regionManifest();
    if (manifest.blocks[manifest.blocks.length-1].module === this.module &&
        manifest.blocks[manifest.blocks.length-1].delta === this.delta) {
      alert('This is already the last block in this region.');
      return false;
    }
    this.setInProgress();
    var tile_index = manifest.blockIndex[this.module + '-' + this.delta];
    var next_tile_index = tile_index + 1;
    var tile_weight = manifest.blocks[tile_index].weight;
    manifest.blocks[tile_index].weight = manifest.blocks[next_tile_index].weight;
    manifest.blocks[next_tile_index].weight = tile_weight;
    this.requestRegion(manifest, $.proxy(function() {
      $("[data-module='" + this.module + "'][data-delta='" + this.delta + "'] " + this.selector.moveLink  + ':eq(0)').click();
    }, this));
    return false;
  };

  Tile.prototype.moveCancel = function(e) {
    window.location.reload();
  };

  Tile.prototype.regionManifest = function() {
    var region = this.region.attr('data-name');
    var manifest = {
      region: region,
      activeContext: this.region.attr('data-context') ? this.region.attr('data-context') : Drupal.settings.tiles.active_context,
      type: this.region.attr('data-type'),
      blockIndex: {},
      blocks: []
    };
    var that = this;
    var weight = 0;
    $(this.selector.tile, this.region).each(function(i) {
      var $t = $(this);
      var module = $t.attr('data-module');
      var delta = $t.attr('data-delta');
      if ($t.closest(that.selector.region)[0] !== that.region[0]) {
        return;
      }
      manifest.blockIndex[module + '-' + delta] = weight;
      manifest.blocks.push({
        module: module,
        delta: delta,
        region: region,
        width: parseInt($t.attr('data-width'), 10),
        weight: weight
      });
      weight++;
    });
    return manifest;
  };

  Tile.prototype.requestRegion = function(manifest, callback) {
    $.ajax({
      type: 'POST',
      url: window.location.toString(),
      data: JSON.stringify(manifest),
      dataType: 'html',
      beforeSend: function(xhr) {
        xhr.setRequestHeader('X-TILES', manifest.type);
      },
      success: $.proxy(function(data, textStatus, jqXHR) {
        this.handleRequestRegionSuccess(data, textStatus, jqXHR);
        callback(data, textStatus, jqXHR);
      }, this),
      error: $.proxy(this, 'handleRequestRegionError')
    });
  };

  Tile.prototype.handleRequestRegionSuccess = function(data, textStatus, jqXHR) {
    this.region.html(data);
    Drupal.attachBehaviors(this.region, Drupal.settings);
  };

  Tile.prototype.handleRequestRegionError = function(jqXHR, textStatus, errorThrown) {
    this.unsetInProgress();
    alert("There was an error changing this tile.");
  };

  Tile.prototype.saveManifest = function() {
    var manifest = this.regionManifest();
    $.ajax({
      type: 'POST',
      url: '/admin/tiles-save-tiles',
      data: JSON.stringify(manifest),
      dataType: 'json',
      success: $.proxy(this.saveHandleSuccess, this),
      error: $.proxy(this.saveHandleError, this)
    });
    return false;
  };

  Tile.prototype.saveHandleSuccess = function() {
    this.unsetDraggable();
    this.unsetResizable();
  };

  Tile.prototype.saveHandleError = function() {
    alert('Sorry, there was a problem saving the updated layout. Please try again after the page reloads.');
    window.location.reload();
  };

  Tile.prototype.setResizable = function() {
    this.domNode.addClass('resizing');
    $('body').addClass('resizing');
    this.addResizeOverlay();
    return this;
  };

  Tile.prototype.unsetResizable = function() {
    this.domNode.removeClass('resizing');
    $('body').removeClass('resizing');
    this.removeResizeOverlay();
    return this;
  };

  /**
   * TODO Use jQuery template
   */
  Tile.prototype.addResizeOverlay = function() {
    // Prevent irresponsible js plugins (twitter I'm looking at you) from using
    // document.write after a block is moved. Using document.write after a page
    // load overwrites the whole dom.
    document.write = function() {};

    var overlayContent = '<span class="width-current">' + Drupal.settings.tiles.steps[this.width] + '</span>';
    overlayContent += '<button class="width-minus">-</button>';
    overlayContent += '<button class="width-plus">+</button>';
    overlayContent += '<button class="save">Save</button>';
    overlayContent += '<span class="cancel">Cancel</span>';
    this.domNode.prepend('<div class="tile-overlay"><div class="inner"><div class="control-wrapper">' + overlayContent + '</div></div></div>');
    $('.width-plus', this.domNode).click($.proxy(this,'widthPlus'));
    $('.width-minus', this.domNode).click($.proxy(this,'widthMinus'));
    $('.cancel', this.domNode).click($.proxy(this, 'resizeCancel'));
    $('.save', this.domNode).click($.proxy(this, 'saveManifest'));
    return this;
  };

  Tile.prototype.widthPlus = function(e) {
    var manifest = this.regionManifest();
    var tile_index = manifest.blockIndex[this.module + '-' + this.delta];
    var tile_width = this.width;
    var steps = Drupal.settings.tiles.stepsKeys;
    var step_index = $.inArray(tile_width, steps);
    var new_width = steps[step_index + 1];

    if (new_width === undefined) {
      alert('This tile is already full width.');
      return false;
    }

    this.setInProgress();
    manifest.blocks[tile_index].width = new_width;
    this.requestRegion(manifest, $.proxy(function() {
      $("[data-module='" + this.module + "'][data-delta='" + this.delta + "'] " + this.selector.resizeLink + ':eq(0)').click();
    }, this));

    return false;
  };

  Tile.prototype.widthMinus = function(e) {
    var manifest = this.regionManifest();
    var tile_index = manifest.blockIndex[this.module + '-' + this.delta];
    var tile_width = this.width;
    var steps = Drupal.settings.tiles.stepsKeys;
    var step_index = $.inArray(tile_width, steps);
    var new_width = steps[step_index - 1];

    if (new_width === undefined) {
      alert('This tile is already at the minimum width.');
      return false;
    }

    this.setInProgress();
    manifest.blocks[tile_index].width = new_width;
    this.requestRegion(manifest, $.proxy(function() {
      $("[data-module='" + this.module + "'][data-delta='" + this.delta + "'] " + this.selector.resizeLink + ':eq(0)').click();
    }, this));

    return false;
  };

  Tile.prototype.removeResizeOverlay = function() {
    $('.tile-overlay', this.domNode).remove();
    return this;
  };

  Tile.prototype.resizeCancel = function(e) {
    window.location.reload();
  };

}(jQuery));
