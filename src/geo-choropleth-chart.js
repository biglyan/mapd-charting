/**
 * The geo choropleth chart is designed as an easy way to create a crossfilter driven choropleth map
 * from GeoJson data. This chart implementation was inspired by
 * {@link http://bl.ocks.org/4060606 the great d3 choropleth example}.
 *
 * Examples:
 * - {@link http://dc-js.github.com/dc.js/vc/index.html US Venture Capital Landscape 2011}
 * @name geoChoroplethChart
 * @memberof dc
 * @mixes dc.colorMixin
 * @mixes dc.baseMixin
 * @example
 * // create a choropleth chart under '#us-chart' element using the default global chart group
 * var chart1 = dc.geoChoroplethChart('#us-chart');
 * // create a choropleth chart under '#us-chart2' element using chart group A
 * var chart2 = dc.compositeChart('#us-chart2', 'chartGroupA');
 * @param {String|node|d3.selection} parent - Any valid
 * {@link https://github.com/mbostock/d3/wiki/Selections#selecting-elements d3 single selector} specifying
 * a dom block element such as a div; or a dom element or d3 selection.
 * @param {String} [chartGroup] - The name of the chart group this chart instance should be placed in.
 * Interaction with a chart will only trigger events and redraws within the chart's group.
 * @return {dc.geoChoroplethChart}
 */
dc.geoChoroplethChart = function (parent, useMap, chartGroup, mapbox) {
    var _useMap = useMap !== undefined ? useMap : false;
    var parentDivId = parent.attributes.id.value;
    var _chart = null;
    if (_useMap) {
        _chart = dc.mapMixin(dc.colorMixin(dc.baseMixin({})),parentDivId, mapbox);
    }
    else {
        _chart = dc.colorMixin(dc.baseMixin({}));
    }

    _chart.colorAccessor(function (d) {
        return d || 0;
    });

/* OVERRIDE -----------------------------------------------------------------*/
    _chart.accent = accentPoly;
    _chart.unAccent = unAccentPoly;

    var _hasBeenRendered = false;
/* --------------------------------------------------------------------------*/

    var _geoPath = d3.geo.path();
    if (_useMap) {
        _geoPath.projection(_chart.mapProject.bind(_chart));
    }

    _chart._projectionFlag;

    var _geoJsons = [];

    function findGeomMinMax (layerIndex) {
        var data = geoJson(layerIndex).data;
        var dataLength = data.length;
        var xMin = 9999999999999;
        var xMax = -9999999999999;
        var yMin = 9999999999999;
        var yMax = -9999999999999;

        for (var d = 0; d < dataLength; d++) {
            var geom = data[d].geometry.coordinates;
            var numGeoms = geom.length;
            for (var g = 0; g < numGeoms; g++) {
                var coords = geom[g];
                var numCoords = coords.length;
                for (var c = 0; c < numCoords; c++) {
                    var coord = coords[c];
                    if (coord[0] < xMin)
                        xMin = coord[0];
                    if (coord[0] > xMax)
                        xMax = coord[0];
                    if (coord[1] < yMin)
                        yMin = coord[1];
                    if (coord[1] > yMax)
                        yMax = coord[1];
                }
            }
        }
        return [[xMin,yMin],[xMax,yMax]];
    }

    _chart.fitBounds = function () {
        if (geoJson(0)) {
            var bounds = geoJson(0).bounds;
            _chart.map().fitBounds(bounds, {animate: false});
        }
    }

    _chart.destroyChart = function () {
        this.map().remove()
        if (this.legend()) {
            this.legend().removeLegend()
        }
    }

    _chart._doRender = function (d) {
        _chart.resetSvg(); // will use map mixin reset svg if we inherit map mixin
        for (var layerIndex = 0; layerIndex < _geoJsons.length; ++layerIndex) {
            var states = _chart.svg().append('g')
                .attr('class', 'layer' + layerIndex);
                //.attr('transform', 'translate(0, -16)');

            var regionG = states.selectAll('g.' + geoJson(layerIndex).name)
                .data(geoJson(layerIndex).data)
                .enter()
                .append('g')
                .attr('class', geoJson(layerIndex).name);

            regionG
                .append('path')
                .attr('fill', 'white')
                .attr('d', _geoPath);

            regionG.append('title');

            plotData(layerIndex, d);
        }
        _chart._projectionFlag = false;

/* OVERRIDE -----------------------------------------------------------------*/
        _hasBeenRendered = true;
/* --------------------------------------------------------------------------*/

    };

    function plotData (layerIndex, d) {
        var data = generateLayeredData(d);

        if (isDataLayer(layerIndex)) {
            var regionG = renderRegionG(layerIndex);

            renderPaths(regionG, layerIndex, data);

            //renderTitle(regionG, layerIndex, data);
        }
    }

    function generateLayeredData (d) {
        var data = {};
        var groupAll = d;
        for (var i = 0; i < groupAll.length; ++i) {
            data[_chart.keyAccessor()(groupAll[i])] = _chart.valueAccessor()(groupAll[i]);
        }
        return data;
    }

    function isDataLayer (layerIndex) {
        return geoJson(layerIndex).keyAccessor;
    }

    function renderRegionG (layerIndex) {
        var regionG = _chart.svg()
            .selectAll(layerSelector(layerIndex))
            .classed('selected', function (d) {
                return isSelected(layerIndex, d);
            })
            .classed('deselected', function (d) {
                return isDeselected(layerIndex, d);
            })
            .attr('class', function (d) {
                var layerNameClass = geoJson(layerIndex).name;
                var regionClass = dc.utils.nameToId(geoJson(layerIndex).keyAccessor(d));
                var baseClasses = layerNameClass + ' ' + regionClass;
                if (isSelected(layerIndex, d)) {
                    baseClasses += ' selected';
                }
                if (isDeselected(layerIndex, d)) {
                    baseClasses += ' deselected';
                }
                return baseClasses;
            });
        return regionG;
    }

    function layerSelector (layerIndex) {
        return 'g.layer' + layerIndex + ' g.' + geoJson(layerIndex).name;
    }

/* OVERRIDE EXTEND ----------------------------------------------------------*/
    function accentPoly(label) {
      var layerNameClass = geoJson(0).name; // hack for now as we only allow one layer currently
    _chart.selectAll('g.' + layerNameClass).each(function (d) {
        if (getKey(0,d) == label) {
          _chart.accentSelected(this);
        }
      });
    }

    function unAccentPoly(label) {
      var layerNameClass = geoJson(0).name; // hack for now as we only allow one layer currently
    _chart.selectAll('g.' + layerNameClass).each(function (d) {
        if (getKey(0,d) == label) {
          _chart.unAccentSelected(this);
        }
      });
    }
/* --------------------------------------------------------------------------*/

    function isSelected (layerIndex, d) {
        return _chart.hasFilter() && _chart.hasFilter(getKey(layerIndex, d)) ^ _chart.filtersInverse();
    }

    function isDeselected (layerIndex, d) {
        return _chart.hasFilter() && !isSelected(layerIndex, d)
    }

    function getKey (layerIndex, d) {
        return geoJson(layerIndex).keyAccessor(d);
    }

    function geoJson (index) {
        return _geoJsons[index];
    }

    function renderPaths (regionG, layerIndex, data) {
        var paths = regionG
            .select('path')
            .attr('fill', function () {
                var currentFill = d3.select(this).attr('fill');
                if (currentFill) {
                    return currentFill;
                }
                return '#e2e2e2';
            })
/* OVERRIDE ---------------------------------------------------------------- */
            .on('mouseenter', function(d, i){showPopup(d, i, data);})
            .on('mousemove', positionPopup)
            .on('mouseleave', hidePopup)
/* ------------------------------------------------------------------------- */
            .on('click', function (d) {
                return _chart.onClick(d, layerIndex);
            });

        dc.transition(paths, _chart.transitionDuration()).attr('fill', function (d, i) {
            var dataColor = data[geoJson(layerIndex).keyAccessor(d)]
            return _chart.getColor(dataColor, i)
        });
    }

    _chart.onClick = function (d, layerIndex) {
        var selectedRegion = geoJson(layerIndex).keyAccessor(d);
        _chart.handleFilterClick(d3.event, selectedRegion)
    };

    function renderTitle (regionG, layerIndex, data) {
        if (_chart.renderTitle()) {
            regionG.selectAll('title').text(function (d) {
                var key = getKey(layerIndex, d);

/* OVERRIDE -----------------------------------------------------------------*/
                var value = Number(data[key]).toFixed(2);
                return _chart.title()({key0: key, value: value});
/* --------------------------------------------------------------------------*/

            });
        }
    }

    _chart._doRedraw = function (data) {


/* OVERRIDE -----------------------------------------------------------------*/
        if (!_hasBeenRendered)
            return _chart._doRender();
/* --------------------------------------------------------------------------*/

        for (var layerIndex = 0; layerIndex < _geoJsons.length; ++layerIndex) {
            plotData(layerIndex, data);
            if (_chart._projectionFlag) {
                _chart.svg().selectAll('g.' + geoJson(layerIndex).name + ' path').attr('d', _geoPath);
            }
        }
        _chart._projectionFlag = false;
    };

    /**
     * **mandatory**
     *
     * Use this function to insert a new GeoJson map layer. This function can be invoked multiple times
     * if you have multiple GeoJson data layers to render on top of each other. If you overlay multiple
     * layers with the same name the new overlay will override the existing one.
     * @name overlayGeoJson
     * @memberof dc.geoChoroplethChart
     * @instance
     * @see {@link http://geojson.org/ GeoJSON}
     * @see {@link https://github.com/mbostock/topojson/wiki TopoJSON}
     * @see {@link https://github.com/mbostock/topojson/wiki/API-Reference#feature topojson.feature}
     * @example
     * // insert a layer for rendering US states
     * chart.overlayGeoJson(statesJson.features, 'state', function(d) {
     *      return d.properties.name;
     * })
     * @param {geoJson} json - a geojson feed
     * @param {String} name - name of the layer
     * @param {Function} keyAccessor - accessor function used to extract 'key' from the GeoJson data. The key extracted by
     * this function should match the keys returned by the crossfilter groups.
     * @return {dc.geoChoroplethChart}
     */
    _chart.overlayGeoJson = function (json, name, keyAccessor) {
        for (var i = 0; i < _geoJsons.length; ++i) {
            if (_geoJsons[i].name === name) {
                _geoJsons[i].data = json;
                _geoJsons[i].keyAccessor = keyAccessor;
                return _chart;
            }
        }
        _geoJsons.push({name: name, data: json, keyAccessor: keyAccessor});
        _geoJsons[_geoJsons.length - 1].bounds = findGeomMinMax(_geoJsons.length - 1);

        return _chart;
    };

    /**
     * Set custom geo projection function. See the available [d3 geo projection
     * functions](https://github.com/mbostock/d3/wiki/Geo-Projections).
     * @name projection
     * @memberof dc.geoChoroplethChart
     * @instance
     * @see {@link https://github.com/mbostock/d3/wiki/Geo-Projections d3.geo.projection}
     * @see {@link https://github.com/d3/d3-geo-projection Extended d3.geo.projection}
     * @param {d3.projection} [projection=d3.geo.albersUsa()]
     * @return {dc.geoChoroplethChart}
     */
    _chart.projection = function (projection) {
        if (!_useMap) {
            _geoPath.projection(projection);
            _chart._projectionFlag = true;
        }
        return _chart;
    };

    /**
     * Returns all GeoJson layers currently registered with this chart. The returned array is a
     * reference to this chart's internal data structure, so any modification to this array will also
     * modify this chart's internal registration.
     * @name geoJsons
     * @memberof dc.geoChoroplethChart
     * @instance
     * @return {Array<{name:String, data: Object, accessor: Function}>}
     */
    _chart.geoJsons = function () {
        return _geoJsons;
    };

    /**
     * Returns the {@link https://github.com/mbostock/d3/wiki/Geo-Paths#path d3.geo.path} object used to
     * render the projection and features.  Can be useful for figuring out the bounding box of the
     * feature set and thus a way to calculate scale and translation for the projection.
     * @name geoPath
     * @memberof dc.geoChoroplethChart
     * @instance
     * @see {@link https://github.com/mbostock/d3/wiki/Geo-Paths#path d3.geo.path}
     * @return {d3.geo.path}
     */
    _chart.geoPath = function () {
        return _geoPath;
    };

    /**
     * Remove a GeoJson layer from this chart by name
     * @name removeGeoJson
     * @memberof dc.geoChoroplethChart
     * @instance
     * @param {String} name
     * @return {dc.geoChoroplethChart}
     */
    _chart.removeGeoJson = function (name) {
        var geoJsons = [];

        for (var i = 0; i < _geoJsons.length; ++i) {
            var layer = _geoJsons[i];
            if (layer.name !== name) {
                geoJsons.push(layer);
            }
        }

        _geoJsons = geoJsons;

        return _chart;
    };
/* OVERRIDE ---------------------------------------------------------------- */
    function showPopup(d, i, data) {
        var popup = _chart.popup();

        var popupBox = popup.select('.chart-popup-content').html('');

        popupBox.append('div')
            .attr('class', 'popup-legend')
            .style('background-color', _chart.getColor(data[geoJson(0).keyAccessor(d)], i));

        popupBox.append('div')
            .attr('class', 'popup-value')
            .html(function(){
                var key = getKey(0, d);
                var value = isNaN(data[key]) ?  'N/A' : Number(data[key]).toFixed(2);
                return '<div class="popup-value-dim">'+ key +'</div><div class="popup-value-measure">'+ value +'</div>';
            });

        popup.classed('js-showPopup', true);
    }

    function hidePopup() {
        _chart.popup().classed('js-showPopup', false);
    }

    function positionPopup() {
        var coordinates = [0, 0];
        coordinates = d3.mouse(this);
        var x = coordinates[0];
        var y = coordinates[1] - 16;

        var popup =_chart.popup()
            .attr('style', function(){
                return 'transform:translate('+x+'px,'+y+'px)';
            });

        popup.select('.chart-popup-box')
            .classed('align-right', function(){
                return x + d3.select(this).node().getBoundingClientRect().width > _chart.width();
            });
    }
/* ------------------------------------------------------------------------- */

    return _chart.anchor(parent, chartGroup);
};
/* ****************************************************************************
 * END OVERRIDE: dc.geoChoroplethChart                                        *
 * ***************************************************************************/
