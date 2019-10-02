import * as React from 'react';
import { Redirect } from 'react-router-dom';
import { action, observable } from 'mobx';
import { inject, observer } from 'mobx-react';
import autobind from 'autobind-decorator';
import AuthenticationStore from 'app/store/AuthenticationStore';
import oncokbClient from 'app/shared/api/oncokbClientInstance';
import fileDownload from 'js-file-download';
import { Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { CitationText } from 'app/components/CitationText';
import classnames from 'classnames';
import { DownloadButton } from 'app/components/downloadButton/DownloadButton';

enum DOWNLOAD_TYPE {
  ALL_CURATED_GENES,
  ALL_ANNOTATED_VARIANTS,
  ALL_ACTIONABLE_ALTERATIONS
}

@inject('authenticationStore')
@observer
export default class DataAccessPage extends React.Component<{ authenticationStore: AuthenticationStore }> {
  @observable needsRedirect = false;

  @autobind
  @action
  async downloadData(downloadType: DOWNLOAD_TYPE, fileName: string) {
    if (this.props.authenticationStore.isUserAuthenticated) {
      let data;
      switch (downloadType) {
        case DOWNLOAD_TYPE.ALL_ACTIONABLE_ALTERATIONS:
          data = await oncokbClient.utilsAllActionableVariantsTxtGetUsingGET({});
          break;
        case DOWNLOAD_TYPE.ALL_ANNOTATED_VARIANTS:
          data = await oncokbClient.utilsAllAnnotatedVariantsTxtGetUsingGET({});
          break;
        case DOWNLOAD_TYPE.ALL_CURATED_GENES:
          data = await oncokbClient.utilsAllCuratedGenesTxtGetUsingGET({});
          break;
        default:
          break;
      }
      if (data) {
        fileDownload(data.toString(), fileName);
      }
    } else {
      this.needsRedirect = true;
    }
  }

  public render() {
    if (this.needsRedirect) {
      return (
        <Redirect
          to={{
            pathname: '/login',
            state: { from: 'dataAccess' }
          }}
        />
      );
    }
    return (
      <>
        <h6>
          By using OncoKB data, you are agreeing to the OncoKB{' '}
          <a href="terms">
            <u>usage terms</u>
          </a>
          .
        </h6>
        <div className={'mb-3'}>
          <h3 className="title">Annotating Your Files</h3>
          <div>
            You can annotate your data files (mutations, copy number alterations, fusions, and clinical data) with{' '}
            <a href="https://github.com/oncokb/oncokb-annotator" target="_blank">
              OncoKB Annotator
            </a>
            .
          </div>
        </div>
        <div className={'mb-3'}>
          <h3 className="title">Web API</h3>
          <div>
            You can programmatically access the OncoKB data via its{' '}
            <a href="api/v1/swagger-ui.html" target="_blank">
              web API
            </a>
            . Clients to the API can be generated by{' '}
            <a href="https://swagger.io/tools/swagger-codegen/" target="_blank">
              Swagger Codegen
            </a>
            .
          </div>
        </div>
        <div className={'mb-3'}>
          <h3 className="title">Data Download</h3>
          <div>
            OncoKB annotations are fully available for download. Please review the{' '}
            <a href="terms">
              <u>usage terms</u>
            </a>{' '}
            before downloading. Previous versions are available{' '}
            <a href="https://github.com/oncokb/oncokb-public/tree/master/data" target="_blank">
              here
            </a>
            .
          </div>
        </div>
        <div className={'mb-3'}>
          <CitationText />
        </div>
        <div>
          <Button
            size={'sm'}
            className={classnames('mr-1', 'mb-1')}
            onClick={() => this.downloadData(DOWNLOAD_TYPE.ALL_CURATED_GENES, 'allCuratedGenes.txt')}
          >
            <FontAwesomeIcon icon={'cloud-download-alt'} className={'mr-1'} fixedWidth />
            All Curated Genes
          </Button>
          <Button
            size={'sm'}
            className={classnames('mr-1', 'mb-1')}
            onClick={() => this.downloadData(DOWNLOAD_TYPE.ALL_ANNOTATED_VARIANTS, 'allAnnotatedVariants.txt')}
          >
            <FontAwesomeIcon icon={'cloud-download-alt'} className={'mr-1'} fixedWidth />
            All Curated Alterations
          </Button>
          <Button
            size={'sm'}
            className={classnames('mr-1', 'mb-1')}
            onClick={() => this.downloadData(DOWNLOAD_TYPE.ALL_ACTIONABLE_ALTERATIONS, 'allActionableVariants.txt')}
          >
            <FontAwesomeIcon icon={'cloud-download-alt'} className={'mr-1'} fixedWidth />
            Actionable Alterations
          </Button>
        </div>
      </>
    );
  }
}
