import nconf from 'nconf';
import nodemailer from 'nodemailer';
import logger from './logger';

let transporter = nodemailer.createTransport({
	host: nconf.get('EMAIL_SERVER_URL'),
	port: nconf.get('EMAIL_SERVER_PORT') || 587,
	secure: false,
	auth: {
		user: nconf.get('EMAIL_SERVER_AUTH_USER'),
		pass: nconf.get('EMAIL_SERVER_AUTH_PASSWORD'),
	},
});

const adminMail = nconf.get('ADMIN_EMAIL');

let templates = {
	'reset-password': {
		subject: "Password Reset for Habitica",
		text: (variables) => `We received a request to have your Habitica password reset. To get started, open the link below. This link is only valid for 24 hours.\n\n${variables['PASSWORD_RESET_LINK']}`,
		button_text: "Reset Password",
		button_link: (variables) => variables['PASSWORD_RESET_LINK'],
		text_before: () => `We received a request to have your Habitica password reset. To get started, open the link below. This link is only valid for 24 hours. If you did not make this request, please ignore this email.`

	},
	'new-pm': {
		subject: "You Received a Private Message",
		text: (variables) => `You've just received a private message from ${variables['SENDER']} on Habitica. Head to the site to read your message: ${variables['BASE_URL']}`,
		button_text: "Read Message",
		button_link: (variables) => variables['BASE_URL'],
		text_before: (variables) => `You've just received a private message from ${variables['SENDER']} on Habitica.`
	},
	'welcome-v2b': {
		subject: "Welcome to Habitica",
		text: (variables) => `Welcome! To get started simply head over to ${variables['BASE_URL']}.`,
		button_text: "Get Started",
		button_link: (variables) => variables['BASE_URL'],
		text_before: () => `Welcome! To get started simply head over to Habitica.`
	},
	'invited-party': {
		subject: "You Were Invited to Join a Party on Habitica",
		text: (variables) => `${variables['INVITER']} invited you to the party ${variables['PARTY_NAME']}. To join, visit the website: ${variables['BASE_URL']}${variables['PARTY_URL']}`,
		button_text: "Join Party",
		button_link: (variables) => `${variables['BASE_URL']}${variables['PARTY_URL']}`,
		text_before: (variables) => `${variables['INVITER']} invited you to the party ${variables['PARTY_NAME']}.`
	},
	'invited-guild': {
		subject: "You Were Invited to Join a Guild on Habitica",
		text: (variables) => `You have an invitation to the guild ${variables['GUILD_NAME']}. To join, visit the website: ${variables['BASE_URL']}${variables['GUILD_URL']}`,
		button_text: "Join Guild",
		button_link: (variables) => `${variables['BASE_URL']}${variables['GUILD_URL']}`,
		text_before: (variables) => `You have an invitation to the guild ${variables['GUILD_NAME']}.`
	},
	'group-member-join': {
		subject: "You Were Invited to Join a Group on Habitica",
		text: (variables) => `${variables['LEADER']} invited you to the group ${variables['GROUP_NAME']}. To join, visit the website: ${variables['BASE_URL']}`,
		button_text: "Join Group",
		button_link: (variables) => `${variables['BASE_URL']}`,
		text_before: (variables) => `${variables['LEADER']} invited you to the group ${variables['GROUP_NAME']}.`
	},
	'invite-friend': {
		subject: "You Were Invited to Join Habitica",
		text: (variables) => `${variables['INVITER']} invited you to join them on Habitica. To join, visit the website: ${variables['BASE_URL']}${variables['LINK']}`,
		button_text: "Get Started",
		button_link: (variables) => `${variables['BASE_URL']}${variables['LINK']}`,
		text_before: (variables) => `${variables['INVITER']} invited you to join them on Habitica.`
	},
	'invite-friend-guild': {
		subject: "You Were Invited to Join a Guild on Habitica",
		text: (variables) => `You have an invitation to the guild ${variables['GUILD_NAME']}. To join, visit the website: ${variables['BASE_URL']}${variables['GUILD_URL']}`,
		button_text: "Join Guild",
		button_link: (variables) => `${variables['BASE_URL']}${variables['GUILD_URL']}`,
		text_before: (variables) => `You have an invitation to the guild ${variables['GUILD_NAME']}.`
	},
	'invite-boss-quest': {
		subject: "New Boss Quest on Habitica",
		text: (variables) => `${variables['INVITER']} invited you to the quest '${variables['QUEST_NAME']}'. Head over to the party to join: ${variables['BASE_URL']}${variables['PARTY_URL']}`,
		button_text: "Visit Party",
		button_link: (variables) => `${variables['BASE_URL']}${variables['PARTY_URL']}`,
		text_before: (variables) => `${variables['INVITER']} invited you to the quest '${variables['QUEST_NAME']}'. Head over to the party to join the quest.`
	},
	'invite-collection-quest': {
		subject: "New Collection Quest on Habitica",
		text: (variables) => `${variables['INVITER']} invited you to the quest '${variables['QUEST_NAME']}'. Head over to the party to join: ${variables['BASE_URL']}${variables['PARTY_URL']}`,
		button_text: "Visit Party",
		button_link: (variables) => `${variables['BASE_URL']}${variables['PARTY_URL']}`,
		text_before: (variables) => `${variables['INVITER']} invited you to the quest '${variables['QUEST_NAME']}'. Head over to the party to join the quest.`
	},
	'quest-started': {
		subject: "Quest Started on Habitica",
		text: () => `The quest you have joined just started.`,
		button_text: "Visit Habitica",
		button_link: (variables) => variables['BASE_URL'],
		text_before: () => `The quest you have joined just started.`
	},
	'party-invite-rescinded': {
		subject: "Your Party Invite was Rescinded",
		text: (variables) => `You are no longer invited to join the party ${variables['GROUP_NAME']}.`,
		button_text: "Visit Habitica",
		button_link: (variables) => variables['BASE_URL'],
		text_before: (variables) => `You are no longer invited to join the party ${variables['GROUP_NAME']}.`
	},
	'kicked-from-party': {
		subject: "Removed from Party",
		text: (variables) => `You were removed from your party.` + variables['MESSAGE'] ? `\n\nMessage from the party leader:\n${variables['MESSAGE']}` : ``,
		button_text: "Visit Habitica",
		button_link: (variables) => variables['BASE_URL'],
		text_before: (variables) => `You were removed from your party.` + variables['MESSAGE'] ? `<br><br>Message from the party leader:<br>${variables['MESSAGE']}` : ``,
	},
	'kicked-from-guild': {
		subject: "Removed from Guild",
		text: (variables) => `You were removed from the guild ${variables['GROUP_NAME']}.` + variables['MESSAGE'] ? `\n\nMessage from the party leader:\n${variables['MESSAGE']}` : ``,
		button_text: "Visit Habitica",
		button_link: (variables) => variables['BASE_URL'],
		text_before: (variables) => `You were removed from the guild ${variables['GROUP_NAME']}.` + variables['MESSAGE'] ? `<br><br>Message from the party leader:<br>${variables['MESSAGE']}` : ``,
	}
};


let htmlTemplate = (variables, button_text, button_link, text_before) => `<!doctype html>
<html>
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
		<meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
		<meta name="viewport" content="width=device-width,initial-scale=1">
		<title>Habitica</title>
		<link href="https://fonts.googleapis.com/css?family=Roboto:400,400i,700,700i" rel="stylesheet">

		<style>
			/* RESET */
			img, img a {
				border: none;
				max-width: 100%;
				outline: none;
				/* Fix resized images in IE */
				-ms-interpolation-mode: bicubic;
			}

			body {
				background-color: #4F2A93;
				font-family: "Roboto", sans-serif;
				font-size: 1rem; /* 16px */
				line-height: 1.5; /* 24px */
				margin: 0;
				padding: 0;
				/* Render fonts consistently */
				-webkit-font-smoothing: antialiased;
				/* Fix text resizing on mobile */
				-ms-text-size-adjust: 100%;
				-webkit-text-size-adjust: 100%;
			}

			hr {
				border: 0;
				border-bottom: 1px solid #EDECEE;
				margin: 1.25rem 0;
			}

			table {
				border: none;
				border-collapse: separate;
				border-spacing: 0;
				width: 100%;
				/* Remove Outlook's added spacing on tables */
				mso-table-lspace: 0pt;
				mso-table-rspace: 0pt;
			}

			table td {
				font-family: "Roboto", sans-serif;
				font-size: 1rem;
				vertical-align: top;
			}

			/* BODY & CONTAINER */
			.body {
				background-color: #4F2A93;
				width: 100%;
			}

			.container {
				display: block; /* Automatically stretch to max-width */
				margin: 0 auto !important; /* Center */
				max-width: 35rem; /* 560px */
				padding: .5rem;
				width: 35rem;
			}

			.content {
				box-sizing: border-box;
				display: block; /* Fill 100% of .container */
				margin: 0 auto;
				max-width: 35rem;
				padding: 0;
			}

			/* Header, Footer & Main */
			.preheader {
				color: transparent;
				display: none;
				height: 0;
				max-height: 0;
				max-width: 0;
				opacity: 0;
				overflow: hidden;
				mso-hide: all;
				visibility: hidden;
				width: 0;
			}

			.logo {
				display: block;
				margin: 1rem 0 .5rem 0;
				padding: 0;
				text-align: center;
			}

			.logo img { max-height: 2.5rem !important; }

			.header-image { margin-bottom: 1rem; }

			.main {
				background-color: #FFFFFF;
				border-radius: 8px 8px 0 0;
				width: 100%;
			}

			.wrapper {
				box-sizing: border-box;
				padding: 1.5rem 1.5rem 0 1.5rem;
			}

			.bullets {
				margin: 0;
				padding: 0 3rem 0 1rem;
			}

			.bullets img {
				min-height: 3rem !important;
				min-width: 3rem !important;
			}

			.bullets p {
				margin: 0 0 1.5rem 1rem;
				padding: 0;
			}

			.app-footer {
				background-color: #FFFFFF;
				border-radius: 0 0 .5rem .5rem;
				padding: 1rem 0 0 0;
				text-align: center;
			}

			.app-footer img {
				margin: 0 .375rem .25rem .375rem;
				max-height: 2rem !important;
			}

			.app-footer p {
				color: #686274;
				font-size: .75rem; /* 12px */
				line-height: 1.34; /* 16px */
				margin-bottom: .75rem;
			}

			.content-block {
				margin: 0;
				padding: 0;
			}

			.footer {
				clear: both;
				margin: .5rem 0 1.5rem 0;
				text-align: center;
				width: 100%
			}

			.footer p,
			.footer td,
			.footer span,
			.footer a {
				color: #BDA8FF;
				font-size: .75rem;
				line-height: 1.34;
				margin: 0;
				text-align: center;
			}

			.footer a { text-decoration: underline; }

			.footer img { max-height: 2rem !important; }

			/* Typography */
			h1,
			h2,
			h3,
			h4 {
				color: #34313A; /* Outlook heading color override */
				font-family: "Roboto", sans-serif;
				font-weight: 400;
				margin: 0;
				margin-bottom: 1rem;
			}

			h1 {
				color: #686274;
				font-size: 1.25rem;
				line-height: 1.2;
				text-align: center;
				text-transform: capitalize;
			}

			p,
			ul,
			ol {
				color: #34313A;
				font-family: "Roboto", sans-serif;
				font-size: 1rem;
				font-weight: normal;
				line-height: 1.5;
				list-style-position: outside;
				margin: 0 0 1.5rem 0;
			}

			p li,
			ul li,
			ol li { margin-bottom: .5rem; }

			a {
				color: #2995CD;
				text-decoration: none;
			}

			.small-caps {
				color: #EE9109;
				font-size: .75rem;
				font-weight: 600;
				line-height: 1.34;
				margin: 1rem 0 .5rem 0;
			}

			/* Buttons */
			.btn {
				box-sizing: border-box;
				width: 100%;
			}

			.btn > tbody > tr > td { padding-bottom: 1.5rem; }
			.btn table { width: auto; }

			.btn table td {
				background-color: #FFFFFF;
				border-radius: .25rem;
				text-align: center;
			}

			.btn a {
				background-color: #FFFFFF;
				border: none;
				border-radius: .25rem;
				box-sizing: border-box;
				color: #2995CD;
				cursor: pointer;
				display: inline-block;
				font-size: 1rem;
				font-weight: 600;
				margin: 0;
				padding: .875rem 2rem;
				text-decoration: none;
			}

			.btn-primary table td { background-color: #2995CD; }

			.btn-primary a {
				background-color: #2995CD;
				border-color: #2995CD;
				color: #FFFFFF;
			}

			/* Responsive */
			@media only screen and (max-width: 40rem) {
				table[class=body] .logo,
				table[class=body] .header-image { margin-bottom: .5rem !important; }
				table[class=body] .logo img { max-height: 2rem !important; }

				table[class=body] h1 {
					font-size: 1.25rem !important;
					line-height: 1.4 !important;
					margin-bottom: 1rem !important;
				}

				table[class=body] p,
				table[class=body] ul,
				table[class=body] ol,
				table[class=body] td,
				table[class=body] span,
				table[class=body] a {
					font-size: .875rem !important;
					line-height: 1.34 !important;
				}

				table[class=body] ul, ol { padding-left: 1.5rem !important; }

				table[class=body] .wrapper,
				table[class=body] .article { padding: 1rem 1rem 0 1rem !important; }

				table[class=body] .content { padding: 0 1rem !important; }

				table[class=body] .container {
					padding: 0 !important;
					width: 100% !important;
				}

				table[class=body] .main {
					border-left-width: 0 !important;
					border-radius: .25rem .25rem 0 0 !important;
					border-right-width: 0 !important;
				}

				.bullets {
					margin: 0 !important;
					padding: 0 1rem 0 0 !important;
				}

				.bullets img {
					display: none !important;
					height: 0 !important;
					max-height: 0 !important;
					max-width: 0 !important;
					opacity: 0 !important;
					overflow: hidden !important;
					mso-hide: all !important;
					visibility: hidden !important;
					width: 0 !important;
				}

				table[class=body] .btn table,
				table[class=body] .btn a { width: 100% !important; }

				table[class=body] .img-responsive {
					height: auto !important;
					max-width: 100% !important;
					width: auto !important;
				}
			}

			/* Outlook / Hotmail */
			@media all {
				.ExternalClass{ width: 100%; }

				.ExternalClass,
				.ExternalClass p,
				.ExternalClass span,
				.ExternalClass font,
				.ExternalClass td,
				.ExternalClass div {
					line-height: 100%;
				}

				.social-link a {
					color: inherit !important;
					font-family: inherit !important;
					font-size: inherit !important;
					font-weight: inherit !important;
					line-height: inherit !important;
					text-decoration: none !important;
				}
			}
		</style>
		<!-- END CSS STYLES -->
	</head>
	<body class="">
		<table border="0" cellpadding="0" cellspacing="0" class="body">
			<tr>
				<td class="container">
					<!-- START CENTERED WHITE CONTENT -->
					<div class="content">
						<div class="logo">
							<a href="${variables['BASE_URL']}" target="_blank"><img src="https://s3.amazonaws.com/habitica-assets/emails/images/habitica-logo.png" alt="Habitica"></a>
						</div>
						<table class="main">
							<!-- START MAIN CONTENT -->
							<tr>
								<td class="wrapper">
									<table border="0" cellpadding="0" cellspacing="0"><tr><td>
                                        <p>Greetings ${variables['RECIPIENT_NAME']},</p>
                                        <p>${text_before}</p>

                                        <!-- START BUTTON TEMPLATE -->
                                        <table border="0" cellpadding="0" cellspacing="0" class="btn btn-primary">
                                            <tbody>
                                                <tr>
                                                    <td align="center">
                                                        <table border="0" cellpadding="0" cellspacing="0">
                                                            <tbody>
                                                                <tr>
                                                                    <td><a href="${button_link}">${button_text}</a></td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <!-- END BUTTON TEMPLATE -->

                                        <p>Warmly,<br><strong>The Habitica Team</strong></p>
                                    </td></tr></table>
								</td>
							</tr>
						</table>
						<!-- START FOOTER -->
                        <div class="app-footer"></div>
						<div class="footer">
							<table border="0" cellpadding="0" cellspacing="0"><tr><td class="content-block">
                                <p>No longer want to receive these emails?<br> Update your <a href="${variables['BASE_URL']}/user/settings/notifications">email settings</a> or <a href="${variables['BASE_URL']}${variables['RECIPIENT_UNSUB_URL']}">unsubscribe</a>.</p>
							</td></tr></table>
						</div>
						<!-- END FOOTER -->
					</div>
					<!-- END CENTERED WHITE CONTENT -->
				</td>
			</tr>
		</table>
	</body>
</html>
`


export default function sendEmail(emailType, variables, personalVariables) {
	let variablesMap = {};
	variables.forEach(variable => variablesMap[variable.name] = variable.content);

	let template = templates[emailType];
	if (!template) {
		logger.error(new Error(`Could not find email template for '${emailType}'. Won't be able to send the email.`));
		return
	}

	personalVariables.forEach(recipient => {
		let personalVariablesMap = variablesMap
		recipient['vars'].forEach(variable => personalVariablesMap[variable.name] = variable.content);
		logger.info(personalVariablesMap)

		transporter.sendMail({
			from: "Habitica <" + adminMail + ">",
			to: `${personalVariablesMap['RECIPIENT_NAME']} <${recipient.rcpt}>`,
			subject: template.subject,
			text: `Greetings ${personalVariablesMap['RECIPIENT_NAME']},\n\n` + template.text(personalVariablesMap) + "\n\nWarmly,\nThe Habitica Team",
			html: htmlTemplate(personalVariablesMap, template.button_text, template.button_link(personalVariablesMap), template.text_before(personalVariablesMap))
		})
	})
}