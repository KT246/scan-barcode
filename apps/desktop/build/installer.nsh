!include LogicLib.nsh
!include nsDialogs.nsh

!ifndef BUILD_UNINSTALLER

Var PhoneScanLanguage
Var PhoneScanEnglishRadio
Var PhoneScanLaoRadio

Function PhoneScanLanguagePageCreate
  nsDialogs::Create 1018
  Pop $0

  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 18u "Choose language for Phone Scan"
  Pop $0
  ${NSD_CreateLabel} 0 24u 100% 26u "Select the language the app should use after installation."
  Pop $0

  ${NSD_CreateRadioButton} 0 58u 100% 18u "English"
  Pop $PhoneScanEnglishRadio
  ${NSD_Check} $PhoneScanEnglishRadio

  ${NSD_CreateRadioButton} 0 82u 100% 18u "ພາສາລາວ"
  Pop $PhoneScanLaoRadio

  nsDialogs::Show
FunctionEnd

Function PhoneScanLanguagePageLeave
  ${NSD_GetState} $PhoneScanLaoRadio $0

  ${If} $0 == ${BST_CHECKED}
    StrCpy $PhoneScanLanguage "lo"
  ${Else}
    StrCpy $PhoneScanLanguage "en"
  ${EndIf}
FunctionEnd

!macro customWelcomePage
  !insertmacro skipPageIfUpdated
  Page custom PhoneScanLanguagePageCreate PhoneScanLanguagePageLeave
!macroend

!macro customInstall
  ${ifNot} ${isUpdated}
    IfFileExists "$APPDATA\Phone Scan\settings.json" phoneScanLanguageDone
    CreateDirectory "$APPDATA\Phone Scan"
    FileOpen $0 "$APPDATA\Phone Scan\settings.json" w

    ${If} $PhoneScanLanguage == "lo"
      FileWrite $0 "{$\r$\n  $\"autoEnter$\": true,$\r$\n  $\"autoTab$\": false,$\r$\n  $\"suffix$\": $\"enter$\",$\r$\n  $\"typingDelayMs$\": 80,$\r$\n  $\"language$\": $\"lo$\",$\r$\n  $\"hasChosenLanguage$\": true$\r$\n}$\r$\n"
    ${Else}
      FileWrite $0 "{$\r$\n  $\"autoEnter$\": true,$\r$\n  $\"autoTab$\": false,$\r$\n  $\"suffix$\": $\"enter$\",$\r$\n  $\"typingDelayMs$\": 80,$\r$\n  $\"language$\": $\"en$\",$\r$\n  $\"hasChosenLanguage$\": true$\r$\n}$\r$\n"
    ${EndIf}

    FileClose $0
    phoneScanLanguageDone:
  ${endIf}
!macroend

!endif
