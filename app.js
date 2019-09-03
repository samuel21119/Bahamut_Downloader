const fs = require('fs');
const http = require('http');
const path = require('path');
const math = require('math');
const request = require('request');
const cheerio = require('cheerio');

var down_path = '';
var link = '';
var stage = 0;
var PARALLEL = 10;

var PAGES = 0, TITLE = '', HIDDEN_DOWNLOAD = false, download_cnt = 0, downloaded = 0, downloading = 0;
UserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:68.0) Gecko/20100101 Firefox/68.0';

function input() {
    const input = document.getElementById('input');
    const out = document.querySelector('.output');
    const value = input.value;
    switch (stage) {
        case 0: // Speed
            if (value != '')
                PARALLEL = value;
            stage = 1;
            out.innerText = 'Please input forum link: ';
            break;
        case 1:
            link = value;
            out.innerText = 'Download hidden photos (y/n)? (Default: No)';
            stage = 2;
            break;
        case 2: // Get pages
            out.innerText = 'Fetching pages...';
            Get_Page(link);
            var val = value.toLowerCase();
            HIDDEN_DOWNLOAD = false;
            if (val === 'y' || val === 'yes' || val === '1')
                HIDDEN_DOWNLOAD = true;
            break;
        case 3:
            var arr = value.split(' ');
            var start = Number(arr[0]);
            var end = Number(arr[1]);
            if (1 <= start && start <= end && end <= PAGES) {
                downloaded = 0;
                hide('send', true);
                hide('progress', false); 
                out.innerText = TITLE;
                download(start, end);
                stage = -1;
            }
            break;
        case -1:
            out.innerText = 'Please input forum link: ';
            stage = 1;
    }
    input.value = '';
}
function hide(object, status) {
    if (status)
        document.getElementById(object).style.display = 'none';
    else
        document.getElementById(object).style.display = 'block';
}


http.globalAgent.maxSockets = Infinity;

async function exit_program() {
    hide('send', false);
    hide('progress', true); 
    document.querySelector('.output').innerText = 'Download complete!\nHit \'Enter\' to continue.';
    document.getElementById('input').focus();
    stage = -1;
}


function Get_Page(link) {
    var error = function() {
        document.querySelector('.output').innerText = 'Fetch error!\nPress enter to retry.';
        stage = -1;
    }
    request({url: link, headers: {'User-Agent': UserAgent}}, async function(err, resp, body) {
        if (err || resp.statusCode !== 200) {
            error();
            return;
        }
        var keyword = '...<a href="?page=';
        var index = body.indexOf(keyword) + keyword.length;
        if (index < keyword.length)
            error();
        var page = '';
        while (body[index] != '&')
            page += body[index++];
        PAGES = parseInt(page);
        document.querySelector('.output').innerText = `Total pages: ${page}\nInput download photo range(ex: 1 5):`;

        keyword = '<h1 class="c-post__header__title ">';
        index = body.indexOf(keyword) + keyword.length;
        if (index < keyword.length) {
            error();
            return;
        }
        TITLE = '';
        while (body[index] != '<' || body[index + 1] != '/' || body[index + 2] != 'h' || body[index + 3] != '1')
            TITLE += body[index++];
        TITLE = replace_str(TITLE);
        stage = 3;
    });
}
function download(start, end) {
    var p = path.join(down_path, TITLE);
    fs.mkdir(p, function(err) {});
    downloading = downloaded = download_cnt = 0;
    document.getElementById('progress-circle').className = 'progress-circle p0';
    document.getElementById('progress-span').textContent = '0%';
    for (var i = start; i <= end; i++) {
        run(i, p);
    }
}
function run(i, p) {
    request({url: link + `&page=${i}`, headers: {'User-Agent': UserAgent}}, async function(err, resp, body) {
        if (HIDDEN_DOWNLOAD === false) {
            const $ = await cheerio.load(body);
            await $('section[style*="display:none"]').remove();
            body = await $.html();
        }
        var cnt = 1;
        var keyword = '<a class="photoswipe-image" href="';
        var index = body.indexOf(keyword);
        for (; index !== -1; index = body.indexOf(keyword, index)) {
            index += keyword.length;
            var addr = '';
            while (body[index] !== '\"' || body[index + 1] !== '>')
                addr += body[index++];
            // document.querySelector('.progress').innerText = `${downloaded}/${download_cnt}`;
            download_cnt++;
            photo(addr, path.join(p, `${i}-${cnt++}`), 0, function() {
                downloading--;
                if (++downloaded === download_cnt) {
                    exit_program();
                }else {
                    var progress = math.floor(downloaded * 100 / download_cnt);
                    var add = 'p' + progress;
                    if (progress > 50) add += ' over50';
                    document.getElementById('progress-circle').className = 'progress-circle ' + add;
                    document.getElementById('progress-span').textContent = progress + '%';
                }
            });
        }
    });
}
async function photo(link, p, cnt, callback) {
    if (cnt === 0) {
        await wait();
    }
    if (cnt > 5) {
        callback();
        return;
    }
    request({url: link, headers: {'User-Agent': UserAgent}}).on('error', function(err) {
        console.log(err);
        photo(link, p, cnt + 1, callback);
        return;
    }).pipe(fs.createWriteStream(p + path.extname(link).toLowerCase())).on('close', callback);
}


function replace_str(str) {
    str = str.replace(/\//g, ' ');
    str = str.replace(/\\/g, ' ');
    str = str.replace(/:/g, ' ');
    str = str.replace(/\*/g, ' ');
    str = str.replace(/\"/g, ' ');
    str = str.replace(/</g, '(');
    str = str.replace(/>/g, ')');
    str = str.replace(/\|/g, ' ');
    str = str.replace(/\?/g, '？');
    return str;
}
function sleep(ms){
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}
function wait() {
    return new Promise(async (resolve, reject) => {
        while (1) {
            if (downloading < PARALLEL) {
                downloading++;
                resolve(0);
                break;
            }
            await sleep(50);
        }
    })
}