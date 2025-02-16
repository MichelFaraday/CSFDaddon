// ==UserScript==
// @name         ČSFD Extended (Title Finder)
// @version      2.9.1
// @description  Rozšíření profilů filmů na ČSFD o funkce jako je hodnocení IMDB či odkaz na Ulož.to a Prehrajto (podporuje až 2 alternativní názvy, english title for foreign sites).
// @author       MichelFaraday
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @license      WTFPL 2
// @include      *csfd.cz/film/*
// @include      *csfd.sk/film/*
// @namespace CSFD-E
// ==/UserScript==
/******/ (() => { // webpackBootstrap
/******/     "use strict";
var __webpack_exports__ = {};

/******************************************************************************
 * Csfd.js
 ******************************************************************************/
class Csfd {
    constructor(csfdPage) {
        this.csfdPage = csfdPage;
    }

    isLoggedIn() {
        return this.csfdPage.find('.my-rating').length > 0;
    }

    getImdbCode() {
        let imdbButton = this.csfdPage.find('a.button-imdb');
        return imdbButton.length > 0
            ? imdbButton.attr('href').match(/(tt\d+)/)[0]
            : null;
    }

    getCurrentUserRatingDate() {
        let ratingDateInText = this.csfdPage.find('.current-user-rating > span').attr('title');
        if (ratingDateInText === undefined) {
            return null;
        }
        return ratingDateInText.match(/.+(\d{2}\.\d{2}\.\d{4})$/)[1];
    }

    isMarkedAsWantToWatch() {
        let controlPanelText = this.csfdPage.find('.control-panel').text();
        return (
            controlPanelText.includes('Upravit ve Chci vidět')
            || controlPanelText.includes('Upraviť v Chcem vidieť')
        );
    }

    getOpenGraphTitle() {
        let fullTitle = $('meta[property="og:title"]').attr('content');
        return fullTitle.replace(/ \| ČSFD\.cz$/, '');
    }

    /**
     * Grab up to 3 alternative titles from .film-names li
     * Also remove the substring "(více)" if it appears.
     */
    getAlternativeTitles() {
        const altTitles = this.csfdPage
            .find('.film-names li')
            .map((i, el) => {
                // text might contain "(více)"
                let rawText = $(el).text().trim();
                // remove (více) anywhere
                let cleaned = rawText.replace(/\(více\)/gi, '').trim();
                return cleaned;
            })
            .get()
            .filter(txt => txt.length > 0);

        // Return only up to 3
        return altTitles.slice(0, 3);
    }

    /**
     * Attempt to find an alt title that is from USA or Britain (some 'English' version).
     * We'll check if the li has a flag alt="USA" or alt="UK"
     * If found, we remove any '(více)' from the text. If none found, return null.
     */
    getEnglishAltTitle() {
        let bestEnglish = null;
        const listItems = this.csfdPage.find('.film-names li');

        // We'll look for a li that contains a flag alt= "USA" or "Velká Británie" or "UK" or something
        // Tweak or add conditions if you need more logic:
        listItems.each((i, li) => {
            const $li = $(li);
            // Check for <img alt="USA" ...> or alt="UK"
            let flagImg = $li.find('img.flag[alt="USA"], img.flag[alt="UK"], img.flag[alt="Velká Británie"]');
            if (flagImg.length > 0) {
                // This is presumably an English alt title
                let rawText = $li.text().trim();
                let cleaned = rawText.replace(/\(více\)/gi, '').trim();
                bestEnglish = cleaned;
                return false; // break .each()
            }
        });

        return bestEnglish;
    }
}

/******************************************************************************
 * ImdbRating.js
 ******************************************************************************/
class ImdbRating {
    constructor(csfd, imdbRating, imdbVotes) {
        this.csfd = csfd;
        this.initializeImdbRating(imdbRating, imdbVotes);
    }

    initializeImdbRating(imdbRating, imdbVotes) {
        if (!imdbRating || imdbRating === 'N/A' || !imdbVotes || imdbVotes === 'N/A') {
            return;
        }

        let imdbVotesSpan = $('<span>')
            .css({
                'display': 'block',
                'font-size': '9px',
                'font-weight': 'normal',
                'line-height': '10px',
                'padding-bottom': '8px',
            })
            .html('<strong>' + imdbVotes + '</strong> hlasů');

        let imdbRatingBox = $('<a>')
            .addClass('rating-average csfd-extended-imdb-rating')
            .css({
                'display': 'block',
                'color': '#000000',
                'cursor': 'pointer',
                'line-height': '60px',
                'background': '#F5C518', // IMDB color
            })
            .attr('href', 'https://www.imdb.com/title/' + this.csfd.getImdbCode())
            .html(imdbRating)
            .append(imdbVotesSpan);

        imdbRatingBox.hover(
            () => { imdbRatingBox.css({'background': '#F5BE18FF'}); },
            () => { imdbRatingBox.css({'background': '#F5C518'}); }
        );

        imdbRatingBox.insertBefore(this.csfd.csfdPage.find('.my-rating'));
    }
}

/******************************************************************************
 * Omdb.js
 ******************************************************************************/
class Omdb {
    constructor(csfd, omdbApiKey, cache) {
        this.csfd = csfd;
        this.omdbApiKey = omdbApiKey;
        this.cache = cache;
        this.getResponse();
    }

    getResponse() {
        let imdbCode = this.csfd.getImdbCode();
        if (imdbCode === null) return;

        let cacheItem = this.cache.getItem(imdbCode);
        if (cacheItem !== null && !this.cache.isItemExpired(cacheItem)) {
            let responseFromCache = cacheItem.value;
            new ImdbRating(this.csfd, responseFromCache.imdbRating, responseFromCache.imdbVotes);
            return;
        }

        let request = $.ajax({
            method: 'GET',
            url: 'https://omdbapi.com/',
            data: {
                apikey: this.omdbApiKey,
                i: imdbCode,
                r: 'json'
            },
        });

        request.done((response) => {
            if (response.imdbRating && response.imdbRating !== 'N/A') {
                this.cache.saveItem(imdbCode, response);
            }
            new ImdbRating(this.csfd, response.imdbRating, response.imdbVotes);
            this.response = response;
        });
    }
}

/******************************************************************************
 * Toolbar.js
 ******************************************************************************/
class Toolbar {
    constructor(csfd) {
        this.csfd = csfd;
        this.initializeToolbar();
    }

    initializeToolbar() {
        let boxButtons = this.csfd.csfdPage.find('.box-rating-container .box-buttons');
        let encodedOpenGraphTitle = encodeURIComponent(this.csfd.getOpenGraphTitle());

        // Grab up to 2 alt titles (for Prehrajto)
        let altTitles = this.csfd.getAlternativeTitles(); // returns array

        // For pirate sites, we try to find an English alt title, else fallback to original
        let englishAlt = this.csfd.getEnglishAltTitle() || this.csfd.getOpenGraphTitle();
        let encodedEnglish = encodeURIComponent(englishAlt);

        // Buttons
        boxButtons.prepend(
            // Original Prehrajto with main (OpenGraph) title
            this.createButton(
                'Prehrajto', //Prehrajto
                'prehraj',
                'https://prehrajto.cz/hledej/' + encodedOpenGraphTitle
            ),
            // Possibly up to 2 alt-title Prehrajtos
            ...altTitles.map((title) => {
                let enc = encodeURIComponent(title);
                return this.createButton(
                    title,
                    'prehraj',
                    'https://prehrajto.cz/hledej/' + enc
                );
            }),

            // Additional site buttons:
            this.createButton(
                'Titulky.com',
                null,
                'http://www.titulky.com/?Fulltext=' + this.stripYear(this.csfd.getOpenGraphTitle())
            ),
            this.createButton(
                'imdb',
                null,
                'https://www.imdb.com/find?q=' + encodedOpenGraphTitle + '&ref_=nv_sr_sm'
            ),

            // Pirate sites: use the English alt if found, else original
            this.createButton(
                '1337x',
                'pirate',
                'https://1337x.to/search/' + encodedEnglish + '/1/'
            ),
            this.createButton(
                'Torrent',
                'pirate',
                'http://www.aiosearch.com/search/4/Torrents/' + encodedEnglish
            ),
        );
    }

    /**
     * Example: remove last 4-digit year from the string
     * E.g. "Carry On (2024)" -> "Carry On"
     */
    stripYear(title) {
        return title.replace(/\(\d{4}\)$/g, '').trim();
    }

    createButton(name, style, url) {
        let backgroundColor = '#DE5254';
        let fontColor = '#FFF';
        let iconClass = 'icon-globe-circle';

        if (style === 'prehraj') {
            backgroundColor = '#3abb19';
            iconClass = 'icon-folder';
        } else if (style === 'uloz') {
            backgroundColor = '#951b81';
            iconClass = 'icon-folder';
        } else if (style === 'pirate') {
            backgroundColor = '#A2A2A2';
            iconClass = 'icon-folder';
        }

        let button = $('<a>')
            .attr('href', url)
            .attr('target', '_blank') // open in new tab
            .addClass('button button-big')
            .css({
                'background-color': backgroundColor,
                'color': fontColor,
                'padding-left': '6px',
                'margin-right': '4px',
                'margin-top': '4px',
                'display': 'inline-block'
            })
            .html('<i class="icon ' + iconClass + '"></i>' + name);

        button.hover(
            (e) => { $(e.target).css({ 'opacity': 1.0 }); },
            (e) => { $(e.target).css({ 'opacity': 0.95 }); },
        );
        button.trigger('mouseleave');

        return button;
    }
}

/******************************************************************************
 * UserRating.js
 ******************************************************************************/
class UserRating {
    constructor(csfd) {
        this.csfd = csfd;
        this.initializeUserRating();
    }

    initializeUserRating() {
        let currentUserRatingDate = this.csfd.getCurrentUserRatingDate();
        if (currentUserRatingDate === null) {
            return;
        }
        let currentUserRatingBoxTitle = this.csfd.csfdPage.find('.my-rating h3');
        if (currentUserRatingBoxTitle.length === 0) {
            return;
        }
        currentUserRatingBoxTitle.text('Hodnoceno ' + currentUserRatingDate);
    }
}

/******************************************************************************
 * WantToWatch.js
 ******************************************************************************/
class WantToWatch {
    constructor(csfd) {
        this.csfd = csfd;
        this.initializeWantToWatch();
    }

    initializeWantToWatch() {
        if (!this.csfd.isMarkedAsWantToWatch()) {
            return;
        }
        let wantToWatch = $('<a>')
            .attr('href', '?name=watchlist&do=modalWindow')
            .css({
                'background': '#BA034F',
                'border-top': '1px solid #D2D2D2',
                'color': '#FFFFFF',
                'display': 'block',
                'opacity': 0.8,
                'padding': '5px',
                'text-align': 'center',
            })
            .html('👁️ Chci vidět');

        wantToWatch.hover(
            (e) => { $(e.target).animate({ 'opacity': 1.0 }); },
            (e) => { $(e.target).animate({ 'opacity': 0.8 }); },
        );

        this.csfd.csfdPage.find('.tabs.tabs-rating.rating-fan-switch').prepend(wantToWatch);
    }
}

/******************************************************************************
 * ImageFloatingPreview.js
 ******************************************************************************/
class ImageFloatingPreview {
    constructor(csfd) {
        this.csfd = csfd;
        this.initializeImageFloatingPreview();
    }

    initializeImageFloatingPreview() {
        this.popup = $('<img>')
            .css({
                'box-shadow': '5px 5px 14px 8px rgba(0,0,0,0.75)',
                'z-index': 999,
                'position': 'absolute',
                'display': 'none'
            });
        $('body').append(this.popup);

        $('.creators a').bind('mouseenter', (e) => {
            let creatorUrl = $(e.target).attr('href');
            this.hoverCreatorLink(creatorUrl);
            this.refreshPopupPosition(e.pageX, e.pageY);
        })
        .bind('mousemove', (e) => this.refreshPopupPosition(e.pageX, e.pageY))
        .bind('mouseleave', () => this.abort());
    }

    showPopup(imageUrl) {
        this.popup.attr('src', imageUrl);
        this.popup.show();
    }

    hidePopup() {
        this.popup.attr('src', '');
        this.popup.hide();
    }

    refreshPopupPosition(x, y) {
        this.popup.css({
            'left': x + 15,
            'top': y + 15,
        });
    }

    abort() {
        if (this.currentRequest && this.currentRequest.abort) {
            this.currentRequest.abort();
        }
        this.hidePopup();
    }

    hoverCreatorLink(url) {
        this.currentRequest = $.ajax({
            method: 'GET',
            url: url,
        });

        this.currentRequest.done((response) => {
            if (typeof response === 'object' && 'redirect' in response) {
                this.hoverCreatorLink(response.redirect);
                return;
            }
            let creatorImageUrl = $(response).find('.creator-profile-content>figure img').attr('src');
            if (creatorImageUrl !== undefined) {
                this.showPopup(creatorImageUrl);
            }
        });
    }
}

/******************************************************************************
 * CacheItem.js
 ******************************************************************************/
class CacheItem {
    constructor(name, value, expireAt) {
        this.name = name;
        this.expireAt = expireAt;
        this.value = value;
    }
}

/******************************************************************************
 * Cache.js
 ******************************************************************************/
class Cache {
    constructor(expirationInSeconds) {
        this.expirationInSeconds = expirationInSeconds;
        this.namespace = 'csfd-extended';
    }

    saveItem(key, value) {
        let cacheItem = new CacheItem(
            this.addNamespaceToName(key),
            value,
            Math.floor(Date.now() / 1000) + this.expirationInSeconds
        );
        localStorage.setItem(this.addNamespaceToName(key), JSON.stringify(cacheItem));
    }

    getItem(key) {
        let cacheItem = localStorage.getItem(this.addNamespaceToName(key));
        return cacheItem !== null ? JSON.parse(cacheItem) : null;
    }

    isItemExpired(cacheItem) {
        return cacheItem.expireAt < Math.floor(Date.now() / 1000);
    }

    addNamespaceToName(name) {
        return this.namespace + '.' + name;
    }
}

/******************************************************************************
 * index.js (main)
 ******************************************************************************/
let cache = new Cache(7 * 24 * 3600);

let csfd = new Csfd($('div.page-content'));
let omdb = new Omdb(csfd, 'ee2fe641', cache);
let userRating = new UserRating(csfd);
let wantToWatch = new WantToWatch(csfd);
let toolbar = new Toolbar(csfd);
let imageFloatingPreview = new ImageFloatingPreview(csfd);

/******/ })();
