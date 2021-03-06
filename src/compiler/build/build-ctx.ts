import * as d from '../../declarations';
import { buildFinish } from './build-finish';
import { hasError } from '../util';


export class BuildContext implements d.BuildCtx {
  appFileBuildCount = 0;
  buildId = -1;
  buildMessages: string[] = [];
  timestamp: string;
  buildResults: d.BuildResults = null;
  bundleBuildCount = 0;
  changedExtensions: string[] = [];
  collections: d.Collection[] = [];
  components: string[] = [];
  data: any = {};
  diagnostics: d.Diagnostic[] = [];
  dirsAdded: string[] = [];
  dirsDeleted: string[] = [];
  entryModules: d.EntryModule[] = [];
  entryPoints: d.EntryPoint[] = [];
  filesAdded: string[] = [];
  filesChanged: string[] = [];
  filesDeleted: string[] = [];
  filesUpdated: string[] = [];
  filesWritten: string[] = [];
  global: d.ModuleFile = null;
  graphData: d.GraphData = null;
  hasCopyChanges = false;
  hasFinished = false;
  hasIndexHtmlChanges = false;
  hasScriptChanges = true;
  hasSlot: boolean = null;
  hasStyleChanges = true;
  hasSvg: boolean = null;
  indexBuildCount = 0;
  isRebuild = false;
  requiresFullBuild = true;
  scriptsAdded: string[] = [];
  scriptsDeleted: string[] = [];
  startTime = Date.now();
  styleBuildCount = 0;
  stylesUpdated = [] as d.BuildStyleUpdate[];
  timeSpan: d.LoggerTimeSpan = null;
  transpileBuildCount = 0;
  validateTypesPromise: Promise<d.ValidateTypesResults>;

  constructor(private config: d.Config, private compilerCtx: d.CompilerCtx, watchResults: d.WatchResults = null) {
    this.setBuildTimestamp();

    // do a full build if there is no watcher
    // or the watcher said the config has updated
    // or we've never had a successful build yet
    this.requiresFullBuild = (!watchResults || watchResults.configUpdated || !compilerCtx.hasSuccessfulBuild);

    this.isRebuild = !!watchResults;

    // increment the active build id
    compilerCtx.activeBuildId++;
    this.buildId = compilerCtx.activeBuildId;

    this.debug(`start build, ${this.timestamp}`);

    const msg = `${this.isRebuild ? 'rebuild' : 'build'}, ${config.fsNamespace}, ${config.devMode ? 'dev' : 'prod'} mode, started`;
    this.timeSpan = this.createTimeSpan(msg);

    if (watchResults != null) {
      this.scriptsAdded = watchResults.scriptsAdded.slice();
      this.scriptsDeleted = watchResults.scriptsAdded.slice();
      this.hasCopyChanges = watchResults.hasCopyChanges;
      this.hasScriptChanges = watchResults.hasScriptChanges;
      this.hasStyleChanges = watchResults.hasStyleChanges;
      this.hasIndexHtmlChanges = watchResults.hasIndexHtmlChanges;

      this.filesChanged.push(...watchResults.filesChanged);
      this.filesUpdated.push(...watchResults.filesUpdated);
      this.filesAdded.push(...watchResults.filesAdded);
      this.filesDeleted.push(...watchResults.filesDeleted);
      this.dirsDeleted.push(...watchResults.dirsDeleted);
      this.dirsAdded.push(...watchResults.dirsAdded);
    }
  }

  setBuildTimestamp() {
    const d = new Date();

    // YYYY-MM-DDThh:mm:ss
    this.timestamp = d.getUTCFullYear() + '-';
    this.timestamp += ('0' + d.getUTCMonth()).slice(-2) + '-';
    this.timestamp += ('0' + d.getUTCDate()).slice(-2) + 'T';
    this.timestamp += ('0' + d.getUTCHours()).slice(-2) + ':';
    this.timestamp += ('0' + d.getUTCMinutes()).slice(-2) + ':';
    this.timestamp += ('0' + d.getUTCSeconds()).slice(-2);
  }

  createTimeSpan(msg: string, debug?: boolean) {
    if ((this.buildId === this.compilerCtx.activeBuildId && !this.hasFinished) || debug) {
      if (debug) {
        msg = `${this.config.logger.cyan('[' + this.buildId + ']')} ${msg}`;
      }
      const timeSpan = this.config.logger.createTimeSpan(msg, debug, this.buildMessages);

      if (!debug && this.compilerCtx.events) {
        this.compilerCtx.events.emit('buildLog', {
          messages: this.buildMessages.slice()
        } as d.BuildLog);
      }

      return {
        finish: (finishedMsg: string, color?: string, bold?: boolean, newLineSuffix?: boolean) => {
          if ((this.buildId === this.compilerCtx.activeBuildId && !this.hasFinished) || debug) {
            if (debug) {
              finishedMsg = `${this.config.logger.cyan('[' + this.buildId + ']')} ${finishedMsg}`;
            }

            timeSpan.finish(finishedMsg, color, bold, newLineSuffix);

            if (!debug) {
              this.compilerCtx.events.emit('buildLog', {
                messages: this.buildMessages.slice()
              } as d.BuildLog);
            }
          }
        }
      };
    }

    return {
      finish: () => {/**/}
    };
  }

  debug(msg: string) {
    this.config.logger.debug(`${this.config.logger.cyan('[' + this.buildId + ']')} ${msg}`);
  }

  get isActiveBuild() {
    return this.compilerCtx.activeBuildId === this.buildId;
  }

  async abort() {
    return buildFinish(this.config, this.compilerCtx, this as any, true);
  }

  async finish() {
    return buildFinish(this.config, this.compilerCtx, this as any, false);
  }

  shouldAbort() {
    if (hasError(this.diagnostics)) {
      // remember if the last build had an error or not
      // this is useful if the next build should do a full build or not
      this.compilerCtx.lastBuildHadError = true;
      return true;
    }

    return false;
  }

  async validateTypesBuild() {
    if (this.shouldAbort() || !this.isActiveBuild) {
      // no need to wait on this one since
      // we already aborted this build
      return;
    }

    if (!this.validateTypesPromise) {
      // there is no pending validate types promise
      // so it probably already finished
      // so no need to wait on anything
      return;
    }

    if (!this.config.watch) {
      // this is not a watch build, so we need to make
      // sure that the type validation has finished
      this.debug(`build, non-watch, waiting on validateTypes`);
      await this.validateTypesPromise;
      this.debug(`build, non-watch, finished waiting on validateTypes`);
    }
  }

}
