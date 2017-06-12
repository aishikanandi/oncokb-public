/**
 * Created by jiaojiao on 6/12/17.
 */
'use strict';

/**
 * @ngdoc function
 * @name oncokbStaticApp.controller:CancerGenesCtrl
 * @description
 * # CancerGenesCtrl
 * Controller of the oncokbStaticApp
 */
angular.module('oncokbStaticApp')
    .controller('CancerGenesCtrl', function($scope, _, api) {
        // DataTable initialization & options
        $scope.dt = {};
        $scope.dt.dtOptions = {
            paging: false,
            hasBootstrap: true,
            language: {
                loadingRecords: '<img src="resources/images/loader.gif">'
            },
            scrollY: 500,
            scrollCollapse: true,
            aaSorting: [[1, 'desc'], [2, 'desc'], [0, 'asc']]
        };

        function displayConvert(obj, keys) {
            _.each(keys, function(key) {
                if (obj[key] === true) obj[key] = 'Yes';
                else obj[key] = 'No';
            });
            return obj;
        }
        api.getCancerGeneList()
            .then(function(content) {
                var tempData = content.data;
                _.each(tempData, function(item) {
                    item = displayConvert(item, ['oncokbAnnotated', 'foundation', 'foundationHeme', 'mskimpact', 'mskheme', 'vogelstein', 'sangerCGC']);
                });
                $scope.cancerGeneList = tempData;
            }, function() {
            });
    });
