//goog.require('X.renderer2D');
//goog.require('X.volume');
var myapp = angular.module('xtk', []);
myapp
.directive('xtkviewer', function ($routeParams, $compile, $rootScope, $modal) {
  return {
    restrict: 'E',
    template: 
        '<div ng-show="showInfo" class="row">'+
            '<div class="col-md-12">'+
                '<button type="button" class="btn btn-default btn-xs" ng-click="open(\'lg\')"><span class="glyphicon glyphicon-info-sign"></span></button>'+
            '</div>'+
        '</div>'+
        '<div class="viewer"></div>',
    link: link,
    scope: {
        image: '=', // {id: XX, name: XXX, labelId: XXX}
        heightRatio: '=',
        labelOpacity: '=',
        showInfo: '@'
    }
  };


  function link (scope, element, attrs) {
    
    console.log('xtk')

    var MOUSEDOWNVIEWER = 'MOUSEDOWNVIEWER';
    var LEFTMOUSEDOWN = 'LEFTMOUSEDOWN';
    var EVENTLOADED = 'EVENTLOADED';
    var VOLUMEINFO = 'VOLUMEINFO';
    var SELECTSLICES = 'SELECTSLICES';
    var ANNOTATIONSOBJECT = 'ANNOTATIONSOBJECT';

    var xtkViewer = function() {
        this.m_viewerArray = null;  
        this.m_volume = null; 
        this.lastannotation = -1;        
        this.currentAnnotations = 0;
    };

    xtkViewer.prototype.init = function(){
       this.initHasRun = true;
       var viewer = element.children()[1];
       function resizeViewer () {
        $(viewer).height($(window).height() * scope.heightRatio);
       };
       $(window).resize(_.throttle(resizeViewer, 500));
       resizeViewer();
       
       this.m_viewerArray = new Array();  
       this.m_volume = new X.volume(); 
       this.lastannotation = -1;        
       this.currentAnnotations = 0;
        
        for(var i = 0; i < 3; i++){
                this.m_viewerArray.push(new X.renderer2D());

                var div = document.createElement('div');
                var container = _.uniqueId('slice_');
                div.setAttribute('id', container);
                div.setAttribute('style','border-top: 2px; background-color: #000; width: 33%; height: 97.5%; float: left; position:relative');

                viewer.appendChild(div);

                this.m_viewerArray[i].container = container;

                if(i == 0){
                        this.m_viewerArray[i].orientation = 'Z';
                }else if(i == 1){
                        this.m_viewerArray[i].orientation = 'Y';
                }else{
                        this.m_viewerArray[i].orientation = 'X';
                }

                this.m_viewerArray[i].init();
                this.m_viewerArray[i].interactor.index = i;
                
                var that = this;
                this.m_viewerArray[i].interactor.onMouseMove = function(event){

                    if(this.interactor.leftButtonDown && !(this.ctrlDown() || this.shiftDown())){
                        var xy2ijk = this.xy2ijk(event.offsetX , event.offsetY);
                        if(xy2ijk){
                            //console.log("mouse pos = " + event.offsetX +", "+ event.offsetY);
                            $rootScope.$broadcast('MOUSEMOVELEFTDOWN', xy2ijk, this.id);
                        }
                    }
                }.bind(this.m_viewerArray[i]);

                this.m_viewerArray[i].onScroll = function(event){
                    scope.$emit('slice_has_changed', this.getSliceIndex());
                }.bind(this.m_viewerArray[i]);
        }
        this.SELECTSLICESFUNCT = this.selectSlices.bind(this);
        this.ANNOTATIONSOBJECTFUNCT = this.newAnnotationView.bind(this);
        this.LEFTMOUSEDOWNFUNCT = this.mouseDownLabel.bind(this);
        
        document.addEventListener(LEFTMOUSEDOWN, this.LEFTMOUSEDOWNFUNCT, false);
        document.addEventListener(SELECTSLICES, this.SELECTSLICESFUNCT, false);
        document.addEventListener(ANNOTATIONSOBJECT, this.ANNOTATIONSOBJECTFUNCT, false);
        for(var i = 0; i < this.m_viewerArray.length; i++){
            scope.$emit('NEWRENDERERID', this.m_viewerArray[i].id);
        }
    };


    xtkViewer.prototype.destroy = function(){
        if (! this.initHasRun) return;

        var viewer = element.children()[1];
        while (viewer.firstChild) {
            viewer.removeChild(viewer.firstChild);
        }
        
        for(var i = 0; i < this.m_viewerArray.length; i++){
            scope.$emit('DELETERENDERERID', this.m_viewerArray[i].id);
            delete this.m_viewerArray[i];
        }
        delete this.m_viewerArray;
        delete this.m_volume;
        
        document.removeEventListener(SELECTSLICES, this.SELECTSLICESFUNCT);
        document.removeEventListener(ANNOTATIONSOBJECT, this.ANNOTATIONSOBJECTFUNCT);
        document.removeEventListener(LEFTMOUSEDOWN, this.LEFTMOUSEDOWNFUNCT);
    };

    xtkViewer.prototype.setImage = function(filename, labelmap, colortable, selectedValue){
                      
        this.m_volume.file = filename;  
          
        if(labelmap != ''){
                this.m_volume.labelmap.file = labelmap;
                this.m_volume.labelmap.colortable.file = colortable;
        }
         
        this.m_volume.modified(true);
         
            this.m_annotations = 0;
            this.m_selectedValue = selectedValue;//this is the id of the current patient, same in table corresponds to the current selected value in the combobox

          
        this.m_viewerArray[0].add(this.m_volume);
        this.m_viewerArray[0].render(); 
        
        
        
        this.m_viewerArray[0].onShowtime = function(){
                this.render();
                scope.$broadcast('EVENTLOADED');
        };  
    };

    xtkViewer.prototype.mouseDownLabel = function(e){   
        var i = parseInt(e.detail);
            if(this.m_viewerArray[i].interactor.leftButtonDown){
                    var pos = this.m_viewerArray[i].interactor.mousePosition;

                    var xy2ijk = this.m_viewerArray[i].xy2ijk(pos[0], pos[1]);
                    

                    if(xy2ijk && !(this.m_viewerArray[i].ctrlDown() || this.m_viewerArray[i].shiftDown())){

                        //console.info(xy2ijk);                   
                        
                        $rootScope.$broadcast(MOUSEDOWNVIEWER, xy2ijk, this.m_viewerArray[i].id, this.m_viewerArray[i].id);
                    }
            }
        
    };

    xtkViewer.prototype.renderSlices = function(){
        if(this.m_viewerArray){
            this.m_viewerArray[1].add(this.m_volume);
            this.m_viewerArray[2].add(this.m_volume);

            this.m_viewerArray[1].render();
            this.m_viewerArray[2].render();
            
            var volinfo = [this.m_volume.RASOrigin, this.m_volume.RASSpacing, this.m_volume.dimensions, this.m_selectedValue, this.m_viewerArray[0]];
            
            var event = new CustomEvent(VOLUMEINFO, { 'detail': volinfo });
            document.dispatchEvent(event);
        }
        
    };

    xtkViewer.prototype.render = function(){
        for(var i = 0; i < this.m_viewerArray.length; i++){
            this.m_viewerArray[i].volumeLabelsChanged = 1;
        }
    };

    xtkViewer.prototype.updateSlices = function(i, j, k){
        for(var n = 0; n < this.m_viewerArray.length; n++){
            this.m_viewerArray[n].updateSlices(i, j, k);
        }
    };

    xtkViewer.prototype.selectSlices = function(e){
        var index = e.detail;
        var dim = this.m_volume.dimensions;
        
        if(0 <= index[0] && index[0] < dim[0] && 0 < index[1] && index[1] < dim[1] && 0 < index[2] && index[2] < dim[2]){
            this.updateSlices(index[0], index[1], index[2]);
        }
        
    };


    xtkViewer.prototype.newAnnotationView = function(e){
        /*for(var i = 0; i < this.m_viewerArray.length; i++){
            this.m_viewerArray[i].setAnnotationTable(e.detail);
        }*/
        var annot = e.detail;
        this.m_annotations = annot;//.annotationMap[annot[0]] = annot[1];
        
        for(var i = 0; i < this.m_viewerArray.length; i++){
            this.m_viewerArray[i].setAnnotationTable(this.m_annotations);
        } 
    };

    xtkViewer.prototype.studyChanged = function(image){
        var filename = '/image/' + image.id + '.nii.gz';
        
        var labelmap = '';
        if(image.labelId){
            labelmap = '/image/' + image.labelId + '.nii.gz';
        }
        
        var colortable = 'http://x.babymri.org/?genericanatomy.txt';
        
        this.destroy();
        this.init();
        this.setImage(filename, labelmap, colortable, image.name || 'imagename');
      };

    var xtkviewer = new xtkViewer();
      
    scope.$on("$destroy", function(){
        xtkviewer.destroy();
        // delete xtkviewer;
    });
  
    scope.$on(EVENTLOADED, function(event, details){
        xtkviewer.renderSlices();
        // Same zoom on each image
        var zoom = _.head(xtkviewer.m_viewerArray).getScale()
        _.tail(xtkviewer.m_viewerArray).forEach(function (viewer) {
          viewer.setScale(zoom);
        });
    });

    scope.$watch('image', function () {
        if (scope.image === undefined) return;
        xtkviewer.studyChanged(scope.image);

        console.log(image)
    });

    scope.$watch('labelOpacity', function () {
        if (scope.labelOpacity === undefined) return;
        xtkviewer.m_volume.labelmap.opacity = parseFloat(scope.labelOpacity);
    });

    scope.$on('change_slice', function (event, coordinates) {
        xtkviewer.updateSlices(coordinates[0], coordinates[1], coordinates[2]);
    });
    
    if (scope.showInfo === 'true') {
        scope.showInfo = true;
    } else {
        scope.showInfo = false;
    }
    scope.open = function (size) {
      var modalInstance = $modal.open({
        templateUrl: 'xtkViewer-modal-template.html',
        size: size
      });
    };
  };
});
