DESTDIR=/

install:
	install -D -t $(DESTDIR)/usr/share/wb-rules-system/rules rules/*
	install -D -t $(DESTDIR)/usr/share/wb-rules-modules/ modules/*.js
	cp -f wbmz2-battery.conf $(DESTDIR)/etc/wbmz2-battery.conf

.PHONY: install
