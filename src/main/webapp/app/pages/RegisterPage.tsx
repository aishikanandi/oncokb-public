import React from 'react';
import { inject, observer } from 'mobx-react';
import {
  action,
  computed,
  IReactionDisposer,
  observable,
  reaction,
} from 'mobx';
import autobind from 'autobind-decorator';
import { Redirect } from 'react-router-dom';
import client from 'app/shared/api/clientInstance';
import { ManagedUserVM } from 'app/shared/api/generated/API';
import {
  LicenseType,
  QUERY_SEPARATOR_FOR_QUERY_STRING,
} from 'app/config/constants';
import { Alert } from 'react-bootstrap';
import { RouterStore } from 'mobx-react-router';
import * as QueryString from 'query-string';
import WindowStore from 'app/store/WindowStore';
import SmallPageContainer from 'app/components/SmallPageContainer';
import MessageToContact from 'app/shared/texts/MessageToContact';
import { ErrorAlert } from 'app/shared/alert/ErrorAlert';
import { NewAccountForm } from 'app/components/newAccountForm/NewAccountForm';
import { getErrorMessage, OncoKBError } from 'app/shared/alert/ErrorAlertUtils';
import { LicenseInquireLink } from 'app/shared/links/LicenseInquireLink';

export type NewUserRequiredFields = {
  username: string;
  password: string;
  email: string;
  jobTitle?: string;
};

enum RegisterStatus {
  REGISTERED,
  NOT_SUCCESS,
  NA,
  READY_REDIRECT,
}

export type IRegisterProps = {
  routing: RouterStore;
  windowStore: WindowStore;
  handleRegister: (newUser: NewUserRequiredFields) => void;
};

export const LICENSE_HASH_KEY = 'license';

@inject('routing', 'windowStore')
@observer
export class RegisterPage extends React.Component<IRegisterProps> {
  @observable registerStatus: RegisterStatus = RegisterStatus.NA;
  @observable registerError: OncoKBError;
  @observable selectedLicense: LicenseType | undefined;

  readonly reactions: IReactionDisposer[] = [];

  constructor(props: Readonly<IRegisterProps>) {
    super(props);
    this.reactions.push(
      reaction(
        () => [props.routing.location.hash],
        ([hash]) => {
          const queryStrings = QueryString.parse(hash, {
            arrayFormat: QUERY_SEPARATOR_FOR_QUERY_STRING,
          });
          if (queryStrings[LICENSE_HASH_KEY]) {
            this.selectedLicense = queryStrings[
              LICENSE_HASH_KEY
            ] as LicenseType;
          }
        },
        { fireImmediately: true }
      ),
      reaction(
        () => this.selectedLicense,
        newSelection => {
          const parsedHashQueryString = QueryString.stringify(
            {
              [LICENSE_HASH_KEY]: newSelection,
            },
            { arrayFormat: QUERY_SEPARATOR_FOR_QUERY_STRING }
          );
          window.location.hash = parsedHashQueryString;
        }
      )
    );
  }

  componentWillUnmount(): void {
    this.reactions.forEach(componentReaction => componentReaction());
  }

  @autobind
  @action
  handleValidSubmit(newAccount: Partial<ManagedUserVM>) {
    client
      .registerAccountUsingPOST({
        managedUserVm: newAccount as ManagedUserVM,
      })
      .then(this.successToRegistered, this.failedToRegistered);
  }

  @action.bound
  redirectToAccountPage() {
    this.registerStatus = RegisterStatus.READY_REDIRECT;
  }

  @action.bound
  successToRegistered() {
    this.registerStatus = RegisterStatus.REGISTERED;
    // setTimeout(this.redirectToAccountPage, REDIRECT_TIMEOUT_MILLISECONDS);
  }

  @action.bound
  failedToRegistered(error: OncoKBError) {
    this.registerStatus = RegisterStatus.NOT_SUCCESS;
    this.registerError = error;
    window.scrollTo(0, 0);
  }

  getErrorMessage(additionalInfo = '') {
    return (
      (additionalInfo ? `${additionalInfo}, w` : 'W') +
      'e were not able to create an account for you.'
    );
  }

  @computed
  get errorRegisterMessage() {
    return this.getErrorMessage(getErrorMessage(this.registerError));
  }

  @autobind
  @action
  onSelectLicense(license: LicenseType | undefined) {
    this.selectedLicense = license;
  }

  getRegisteredMessage(licenseType: LicenseType | undefined) {
    if (licenseType === undefined) {
      return '';
    }
    const companyName =
      licenseType === LicenseType.HOSPITAL ? 'hospital' : 'company';
    return (
      <>
        <p>
          Thank you for creating an OncoKB account. We have sent you an email to
          verify your email address. Please follow the instructions in the email
          to complete registration.
        </p>
        <p>
          After validating your email address, please allow 1-2 business days
          for us to review your request.{' '}
          {licenseType === LicenseType.ACADEMIC ? (
            ''
          ) : (
            <span>
              If your {companyName} already has a license, we will grant you
              access soon. If your {companyName} does not yet have a license, we
              will contact you with terms. Please reach out to{' '}
              <LicenseInquireLink /> with any questions.
            </span>
          )}
        </p>
      </>
    );
  }

  render() {
    if (this.registerStatus === RegisterStatus.READY_REDIRECT) {
      return <Redirect to={'/'} />;
    }

    if (this.registerStatus === RegisterStatus.REGISTERED) {
      return (
        <SmallPageContainer className={'registerPage'}>
          <div>
            <Alert variant="info">
              {this.getRegisteredMessage(this.selectedLicense)}
            </Alert>
          </div>
        </SmallPageContainer>
      );
    }

    return (
      <div className={'registerPage'}>
        {this.registerError ? <ErrorAlert error={this.registerError} /> : null}
        <NewAccountForm
          isLargeScreen={this.props.windowStore.isLargeScreen}
          defaultLicense={this.selectedLicense}
          onSubmit={this.handleValidSubmit}
          byAdmin={false}
          onSelectLicense={this.onSelectLicense}
        />
      </div>
    );
  }
}
