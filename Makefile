PREFIX = /usr

install:
	install -Dm0644 rules/* -t $(DESTDIR)$(PREFIX)/share/wb-rules-system/rules
	install -Dm0644 wbmz2-battery.conf -t $(DESTDIR)/etc

.PHONY: install
