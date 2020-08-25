package org.mskcc.cbio.oncokb.web.rest;


import io.github.jhipster.security.RandomUtil;
import org.apache.commons.lang3.StringUtils;
import org.mskcc.cbio.oncokb.domain.Token;
import org.mskcc.cbio.oncokb.domain.User;
import org.mskcc.cbio.oncokb.domain.enumeration.MailType;
import org.mskcc.cbio.oncokb.querydomain.UserTokenUsage;
import org.mskcc.cbio.oncokb.repository.UserRepository;
import org.mskcc.cbio.oncokb.security.AuthoritiesConstants;
import org.mskcc.cbio.oncokb.security.uuid.TokenProvider;
import org.mskcc.cbio.oncokb.service.*;
import org.mskcc.cbio.oncokb.service.dto.UserDTO;
import org.mskcc.cbio.oncokb.service.mapper.UserMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

import static org.mskcc.cbio.oncokb.config.Constants.DAY_IN_SECONDS;
import static org.mskcc.cbio.oncokb.config.Constants.HALF_YEAR_IN_SECONDS;
import static org.mskcc.cbio.oncokb.domain.enumeration.MailType.TRIAL_ACCOUNT_IS_ABOUT_TO_EXPIRE;
import static org.mskcc.cbio.oncokb.domain.enumeration.MailType.VERIFY_EMAIL_BEFORE_ACCOUNT_EXPIRES;

/**
 * REST controller for managing crobjobs.
 */
@RestController
@RequestMapping("/api/cronjob")
public class CronJobController {

    private final Logger log = LoggerFactory.getLogger(CronJobController.class);

    private final UserService userService;

    private final TokenService tokenService;

    private final TokenStatsService tokenStatsService;

    @Autowired
    private UserMapper userMapper;

    private final MailService mailService;

    private final UserMailsService userMailsService;

    private final TokenProvider tokenProvider;

    private final AuditEventService auditEventService;

    public CronJobController(UserService userService,
                             MailService mailService, TokenProvider tokenProvider,
                             TokenService tokenService, AuditEventService auditEventService,
                             TokenStatsService tokenStatsService, UserMailsService userMailsService
    ) {

        this.userService = userService;
        this.mailService = mailService;
        this.tokenProvider = tokenProvider;
        this.tokenService = tokenService;
        this.auditEventService = auditEventService;
        this.tokenStatsService = tokenStatsService;
        this.userMailsService = userMailsService;
    }

    /**
     * Old audit events should be automatically deleted after * days.
     * Days depends on JHipster property audit audit-events: retention-period
     */
    @GetMapping(path = "/remove-old-audit-events")
    public void removeOldAuditEvents() {
        auditEventService.removeOldAuditEvents();
    }

    /**
     * Old token stats should be automatically deleted after * days.
     * Days depends on JHipster property audit audit-events: retention-period
     */
    @GetMapping(path = "/remove-old-token-stats")
    public void removeOldTokenStats() {
        tokenStatsService.removeOldTokenStats();
    }

    /**
     * Not activated users should be automatically deleted after * days.
     * Days depends on JHipster property audit audit-events: retention-period
     */
    @GetMapping(path = "/remove-not-activate-users")
    public void removeNotActivatedUsers() {
        // this is not really working due to the foreign key constraints
//        userService.removeNotActivatedUsers();
    }

    /**
     * {@code GET  /renew-tokens} : Checking token expiration.
     */
    @GetMapping(path = "/renew-tokens")
    public void tokensRenewCheck() {
        log.info("Started the cronjob to renew tokens");

        // Since the send email is an async method, we need to record a list of users to prevent sending email multiple times
        Set<String> notifiedUserIds = new HashSet<>();
        int[] timePointsToCheck = new int[]{3, 14};
        for (int daysToExpired : timePointsToCheck) {
            tokenCheckByTime(daysToExpired, notifiedUserIds);
        }
    }

    /**
     * {@code GET  /generate-tokens} : Generate tokens for all users without tokens.
     */
    @GetMapping(path = "/generate-tokens")
    public void generateTokens() {
        log.info("Started the cronjob to generate tokens");
        List<UserDTO> userDTOs = userService.getAllActivatedUsersWithoutTokens();

        // Make sure the token has enough time before sending out the emails to users to verify the email address
        Instant newTokenDefaultExpirationDate = Instant.now().plusSeconds(DAY_IN_SECONDS * 15);
        userDTOs.stream().forEach(userDTO -> {
            Instant expirationDate = userDTO.getCreatedDate() == null ? newTokenDefaultExpirationDate : userDTO.getCreatedDate().plusSeconds(HALF_YEAR_IN_SECONDS);
            tokenProvider.createToken(userMapper.userDTOToUser(userDTO), Optional.of(expirationDate.isBefore(newTokenDefaultExpirationDate) ? newTokenDefaultExpirationDate : expirationDate), Optional.empty());
        });
    }

    /**
     * {@code GET  /update-token-stats} : Update token stats.
     */
    @GetMapping(path = "/update-token-stats")
    public void updateTokenStats() {
        log.info("Started the cronjob to update token stats");
        List<UserTokenUsage> tokenUsages = tokenStatsService.getUserTokenUsage(Instant.now());

        // Update tokens with token usage
        tokenUsages.stream().forEach(tokenUsage -> {
            if (!tokenUsage.getToken().getCurrentUsage().equals(tokenUsage.getCount())) {
                Optional<Token> tokenOptional = tokenService.findByToken(tokenUsage.getToken().getToken());
                if (tokenOptional.isPresent()) {
                    tokenOptional.get().setCurrentUsage(tokenUsage.getCount());
                    tokenService.save(tokenOptional.get());
                }
            }
        });

        // Update tokens without token usage
        List<Long> tokenWithStats = tokenUsages.stream().map(tokenUsage -> tokenUsage.getToken().getId()).collect(Collectors.toList());
        List<Token> tokens = tokenService.findAll().stream().filter(token -> !tokenWithStats.contains(token.getId())).collect(Collectors.toList());
        tokens.stream().forEach(token -> {
            if (!token.getCurrentUsage().equals(0)) {
                token.setCurrentUsage(0);
                tokenService.save(token);
            }
        });
    }

    /**
     * {@code GET  /check-trial-accounts} : Check the status of trial accounts
     */
    @GetMapping(path = "/check-trial-accounts")
    public void checkTrialAccounts() {
        log.info("Started the cronjob to check the status of trial accounts");
        final int DAYS_TO_CHECK = 3;
        List<Token> tokens = tokenService
            .findAllExpiresBeforeDate(Instant.now().plusSeconds(DAY_IN_SECONDS * DAYS_TO_CHECK))
            .stream()
            .filter(token -> !token.isRenewable() && token.getExpiration().isAfter(Instant.now()))
            .filter(token -> {
                // Do not include users that have been notified in the
                return this.userMailsService.findUserMailsByUserAndMailTypeAndSentDateAfter(token.getUser(), TRIAL_ACCOUNT_IS_ABOUT_TO_EXPIRE, token.getExpiration().minusSeconds(DAY_IN_SECONDS * DAYS_TO_CHECK)).isEmpty();
            })
            .collect(Collectors.toList());
        List<UserDTO> userDTOS = tokens
            .stream()
            .map(token -> userMapper.userToUserDTO(token.getUser()))
            .collect(Collectors.toList());

        mailService.sendTrialAccountExpiresMail(DAYS_TO_CHECK, userDTOS);
    }

    private void tokenCheckByTime(int daysToExpire, Set<String> notifiedUserIds) {
        int secondsToExpire = DAY_IN_SECONDS * daysToExpire;
        List<Token> tokensToBeExpired = tokenService.findAllExpiresBeforeDate(Instant.now().plusSeconds(secondsToExpire));// Only return the users that token is about to expire and no email has been sent before.
        List<User> selectedUsers = new ArrayList<>();

        tokensToBeExpired.forEach(token -> {
            if (token.getUser().getActivated() &&
                // Skip PUBLIC_WEBSITE token since it's short live
                !this.userService.userHasAuthority(token.getUser(), AuthoritiesConstants.PUBLIC_WEBSITE) &&
                !notifiedUserIds.contains(token.getUser().getLogin()) &&
                token.isRenewable() &&
                // Do not include users that have been notified during the validate Token period
                this.userMailsService.findUserMailsByUserAndMailTypeAndSentDateAfter(token.getUser(), VERIFY_EMAIL_BEFORE_ACCOUNT_EXPIRES, token.getExpiration().minusSeconds(secondsToExpire)).isEmpty()
            ) {
                selectedUsers.add(token.getUser());
                notifiedUserIds.add(token.getUser().getLogin());
            }
        });
        selectedUsers.stream().distinct().forEach(user -> {
            if (canBeAutoRenew(user)) {
                // For certain users, we should automatically renew the account
                tokensToBeExpired.stream().filter(token -> token.getUser().equals(user)).forEach(token -> renewToken(token));
            } else {
                // Generate an activation key, but only if the activation key is not null, so we would not send emails with different activation key.
                // This is to prevent user clicks on 14 days email when seen 3 days email.
                if (StringUtils.isEmpty(user.getActivationKey())) {
                    userService.generateNewActivationKey(user);
                }

                // Send email to ask user to verify the account ownership
                mailService.sendEmailDeclareEmailOwnership(userMapper.userToUserDTO(user), VERIFY_EMAIL_BEFORE_ACCOUNT_EXPIRES, daysToExpire);
            }
        });
    }

    private boolean canBeAutoRenew(User user) {
        return userService.userHasAuthority(user, AuthoritiesConstants.ADMIN) ||
            userService.userHasAuthority(user, AuthoritiesConstants.BOT) ||
            (
                !StringUtils.isEmpty(user.getEmail()) && (
                    user.getEmail().endsWith("localhost") ||
                        user.getEmail().endsWith("oncokb.org")
                )
            );
    }

    private void renewToken(Token token) {
        token.setExpiration(token.getExpiration().plusSeconds(tokenProvider.EXPIRATION_TIME_IN_SECONDS));
        tokenService.save(token);
    }
}
