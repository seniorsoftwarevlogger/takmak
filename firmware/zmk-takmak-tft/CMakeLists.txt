if(CONFIG_SHIELD_TAKMAK_TFT_DONGLE)
  target_sources(app PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src/status_screen.c)
elseif(CONFIG_SHIELD_TAKMAK_TFT_LEFT OR CONFIG_SHIELD_TAKMAK_TFT_LEFT_BENCH)
  target_sources(app PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/src/portrait_screen.c
    ${CMAKE_CURRENT_SOURCE_DIR}/src/behavior_tft_mode.c
    ${CMAKE_CURRENT_SOURCE_DIR}/src/bench_button.c)
endif()
