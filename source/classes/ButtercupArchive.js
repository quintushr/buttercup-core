(function(module) {

	"use strict";

	var Westley = require(__dirname + "/Westley.js"),
		Inigo = require(__dirname + "/InigoGenerator.js"),
		ManagedGroup = require(__dirname + "/ManagedGroup.js");

	var signing = require(GLOBAL.root + "/tools/signing.js"),
		searching = require(GLOBAL.root + "/tools/searching.js");

	/**
	 * The base Buttercup Archive class
	 * @class Archive
	 */
	var Archive = function() {
		this._westley = new Westley();
		this._getWestley().execute(
			Inigo.create(Inigo.Command.Comment)
				.addArgument('Buttercup archive created (todo: date)')
				.generateCommand()
		);
		this._getWestley().execute(
			Inigo.create(Inigo.Command.Format)
				.addArgument(signing.getFormat())
				.generateCommand()
		);
	};

	/**
	 * Create a new group
	 * @param {String=} title The title for the group
	 * @returns {ManagedGroup}
	 * @memberof Archive
	 */
	Archive.prototype.createGroup = function(title) {
		var managedGroup = ManagedGroup.createNew(this._getWestley());
		if (title) {
			managedGroup.setTitle(title);
		}
		return managedGroup;
	};

	/**
	 * Get all groups (root) in the archive
	 * @returns {ManagedGroups[]} An array of ManagedGroups
	 * @memberof Archive
	 */
	Archive.prototype.getGroups = function() {
		var westley = this._getWestley();
		return (westley.getDataset().groups || []).map(function(rawGroup) {
			return new ManagedGroup(westley, rawGroup);
		});
	};

	/**
	 * Get the underlying Westley instance
	 * @protected
	 * @returns {Westley}
	 * @memberof Archive
	 */
	Archive.prototype._getWestley = function() {
		return this._westley;
	};

	module.exports = Archive;

})(module);