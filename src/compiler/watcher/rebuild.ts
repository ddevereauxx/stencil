import { CompilerCtx, Config, WatchResults } from '../../declarations';
import { configFileReload } from  '../../compiler/config/config-reload';


export function rebuild(config: Config, compilerCtx: CompilerCtx, watchResults: WatchResults) {

  // files changed include updated, added and deleted
  watchResults.filesChanged = watchResults.filesUpdated.concat(watchResults.filesAdded, watchResults.filesDeleted),

  watchResults.scriptsAdded = watchResults.filesAdded.filter(f => {
    return SCRIPT_EXT.some(ext => f.endsWith(ext.toLowerCase()));
  }).map(f => config.sys.path.basename(f));

  watchResults.scriptsDeleted = watchResults.filesDeleted.filter(f => {
    return SCRIPT_EXT.some(ext => f.endsWith(ext.toLowerCase()));
  }).map(f => config.sys.path.basename(f));

  // collect up all the file extensions from changed files
  watchResults.filesChanged.forEach(filePath => {
    const ext = filePath.split('.').pop().toLowerCase();
    if (!watchResults.changedExtensions.includes(ext)) {
      watchResults.changedExtensions.push(ext);
    }
  });
  watchResults.changedExtensions.sort();

  // figure out what type of changes this watch build has from the changed file extension
  watchResults.hasScriptChanges = watchResults.changedExtensions.some(ext => SCRIPT_EXT.includes(ext));
  watchResults.hasStyleChanges = watchResults.changedExtensions.some(ext => STYLE_EXT.includes(ext));

  const srcIndexHtmlChanged = watchResults.filesChanged.some(fileChanged => {
    // the src index index.html file has changed
    // this file name could be something other than index.html
    return fileChanged === config.srcIndexHtml;
  });

  const anyIndexHtmlChanged = watchResults.filesChanged.some(fileChanged => config.sys.path.basename(fileChanged).toLowerCase() === 'index.html');
  if (anyIndexHtmlChanged) {
    // any index.html in any directory that changes counts too
    watchResults.hasIndexHtmlChanges = true;
  }

  watchResults.hasIndexHtmlChanges = anyIndexHtmlChanged || srcIndexHtmlChanged;

  // print out a pretty message about the changed files
  printWatcherMessage(config, watchResults);

  if (watchResults.configUpdated) {
    configFileReload(config, compilerCtx);
  }

  // kick off the rebuild
  compilerCtx.events.emit('build', watchResults);
}


const SCRIPT_EXT = ['ts', 'tsx', 'js', 'jsx'];
const STYLE_EXT = ['css', 'scss', 'pcss', 'styl', 'stylus', 'less'];


function printWatcherMessage(config: Config, watcherResults: WatchResults) {
  const changedFiles = watcherResults.filesChanged;

  const totalChangedFiles = changedFiles.length;
  let msg: string = null;

  if (totalChangedFiles > MAX_FILE_PRINT) {
    const trimmedChangedFiles = changedFiles.slice(0, MAX_FILE_PRINT - 1);
    const otherFilesTotal = totalChangedFiles - trimmedChangedFiles.length;
    msg = `changed files: ${trimmedChangedFiles.map(f => config.sys.path.basename(f)).join(', ')}`;
    if (otherFilesTotal > 0) {
      msg += `, +${otherFilesTotal} other${otherFilesTotal > 1 ? 's' : ''}`;
    }

  } else if (totalChangedFiles > 1) {
    msg = `changed files: ${changedFiles.map(f => config.sys.path.basename(f)).join(', ')}`;

  } else if (totalChangedFiles > 0) {
    msg = `changed file: ${changedFiles.map(f => config.sys.path.basename(f)).join(', ')}`;

  } else if (watcherResults.dirsAdded.length > 1) {
    msg = `added directories: ${watcherResults.dirsAdded.map(f => config.sys.path.basename(f)).join(', ')}`;

  } else if (watcherResults.dirsAdded.length > 0) {
    msg = `added directory: ${watcherResults.dirsAdded.map(f => config.sys.path.basename(f)).join(', ')}`;

  } else if (watcherResults.dirsDeleted.length > 1) {
    msg = `deleted directories: ${watcherResults.dirsAdded.map(f => config.sys.path.basename(f)).join(', ')}`;

  } else if (watcherResults.dirsDeleted.length > 0) {
    msg = `deleted directory: ${watcherResults.dirsAdded.map(f => config.sys.path.basename(f)).join(', ')}`;
  }

  if (msg != null) {
    config.logger.info(config.logger.cyan(msg));
  }
}

const MAX_FILE_PRINT = 5;
