const {
    app,
    BrowserWindow,
    dialog
} = require('electron');
const fs = require('fs');
const url = require('url');
const path = require('path');
const open = require('open');
const request = require('request');
const pkg = require('./package.json');
UserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:68.0) Gecko/20100101 Firefox/68.0';

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    // darwin = MacOS
    // if (process.platform !== 'darwin') {
    app.quit();
    // }
});

app.on('activate', () => {
    if (win === null) {
        createWindow();
    }
});

function createWindow() {
    // Create the browser window.
    var transparent = process.platform === 'darwin';
    win = new BrowserWindow({
        width: 400,
        height: 400,
        maximizable: false,
        transparent: transparent,
        backgroundColor: "#404040",
        webPreferences: {
            nodeIntegration: true
        }
    });


    win.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    // Open DevTools.
    // win.webContents.openDevTools()
    if (process.platform !== 'darwin') {
        win.removeMenu();
    }
    // When Window Close.
    win.on('closed', () => {
        win = null;
    })
    win.webContents.on('did-finish-load', () => {
        win.webContents.send('download-folder', app.getPath('downloads'));
    })
    // Check new version
    request({
        url: 'https://api.github.com/repos/samuel21119/Bahamut_Downloader/releases/latest',
        headers: {'User-Agent': UserAgent}}, function(err, resp, body) {
        if (err || resp.statusCode !== 200)
            return;
        body = JSON.parse(body);
        current_version = pkg.version;
        latest_version = body.name;
        console.log(latest_version , current_version);
        if (current_version !== latest_version) {
            const options = {
                type: 'question',
                buttons: [ 'Yes', 'No'],
                defaultId: 0,
                title: 'Question',
                message: `Do you want to download now?`,
                detail: `New version ${latest_version} found.`,
            };
            dialog.showMessageBox(null, options, (response) => {
                if (response === 0) {
                    var platform = process.platform === 'darwin' ? 0 : 1;
                    var url = body.assets[platform].browser_download_url;
                    var name = body.assets[platform].name;
                    request({url: url}).on('error', function(err) {return;}).pipe(fs.createWriteStream(path.join(app.getPath('downloads'), name))).on('close', function() {
                        const options = {
                            type: 'question',
                            buttons: [ 'Yes', 'No'],
                            defaultId: 0,
                            title: 'Question',
                            message: `Download complete! Close and install update now?`,
                        };
                        dialog.showMessageBox(null, options, async(response) => {
                            if (response === 0) {
                                open(path.join(app.getPath('downloads'), name));
                                await sleep(3000);
                                app.quit();
                            }
                        });
                    });
                }
            });
        }
    })
}

function sleep(ms){
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}